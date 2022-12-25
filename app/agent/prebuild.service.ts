import fs from "fs/promises";
import path from "path";

import type { PrebuildEvent, Prisma } from "@prisma/client";
import { PrebuildEventStatus } from "@prisma/client";
import type { Logger } from "@temporalio/worker";
import type { Config } from "~/config";
import { Token } from "~/token";
import { unwrap, waitForPromises } from "~/utils.shared";

import type { AgentUtilService } from "./agent-util.service";
import type { FirecrackerService } from "./firecracker.service";
import type { ProjectConfigService } from "./project-config/project-config.service";
import type { ProjectConfig } from "./project-config/validator";
import { doesFileExist, execSshCmd, sha256 } from "./utils";

export class PrebuildService {
  static inject = [
    Token.Logger,
    Token.AgentUtilService,
    Token.ProjectConfigService,
    Token.Config,
  ] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly logger: Logger,
    private readonly agentUtilService: AgentUtilService,
    private readonly projectConfigService: ProjectConfigService,
    config: Config,
  ) {
    this.agentConfig = config.agent();
  }

  devDir = "/home/hocus/dev" as const;
  repositoryDir = `${this.devDir}/project` as const;
  prebuildScriptsDir = `${this.devDir}/.hocus/init` as const;

  getPrebuildTaskPaths(taskIdx: number): {
    scriptPath: string;
    logPath: string;
  } {
    const scriptPath = `${this.prebuildScriptsDir}/task-${taskIdx}.sh`;
    const logPath = `${this.prebuildScriptsDir}/task-${taskIdx}.log`;
    return { scriptPath, logPath };
  }

  async createPrebuildEvent(
    db: Prisma.TransactionClient,
    projectId: bigint,
    gitObjectId: bigint,
    fsFileId: bigint,
    tasks: string[],
  ): Promise<PrebuildEvent> {
    const prebuildEvent = await db.prebuildEvent.create({
      data: {
        projectId,
        gitObjectId,
        fsFileId,
        status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING,
      },
    });
    await Promise.all(
      tasks.map(async (task, idx) => {
        const paths = this.getPrebuildTaskPaths(idx);
        const vmTask = await this.agentUtilService.createVmTask(db, [
          "bash",
          "-o",
          "pipefail",
          "-o",
          "errexit",
          "-o",
          "allexport",
          "-c",
          `bash "${paths.scriptPath}" 2>&1 | tee "${paths.logPath}"`,
        ]);
        await db.prebuildEventTask.create({
          data: {
            prebuildEventId: prebuildEvent.id,
            vmTaskId: vmTask.id,
            idx,
            originalCommand: task,
          },
        });
      }),
    );
    return prebuildEvent;
  }

  async linkGitBranchesToPrebuildEvent(db: Prisma.TransactionClient, prebuildEventId: bigint) {
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: prebuildEventId },
    });
    const gitBranches = await db.gitBranch.findMany({
      where: { gitObjectId: prebuildEvent.gitObjectId },
    });
    await db.prebuildEventToGitBranch.createMany({
      data: gitBranches.map((gitBranch) => ({
        prebuildEventId,
        gitBranchId: gitBranch.id,
      })),
    });
  }

  /**
   * Creates a prebuild event and links all git branches that point to the given git object id to it.
   */
  async preparePrebuild(
    db: Prisma.TransactionClient,
    projectId: bigint,
    gitObjectId: bigint,
    fsFileId: bigint,
    tasks: string[],
  ): Promise<PrebuildEvent> {
    const prebuildEvent = await this.createPrebuildEvent(
      db,
      projectId,
      gitObjectId,
      fsFileId,
      tasks,
    );
    await this.linkGitBranchesToPrebuildEvent(db, prebuildEvent.id);
    return prebuildEvent;
  }

  /**
   * Copies the contents of `repositoryDrivePath` into `outputDrivePath`, and checks
   * out the given branch there.
   *
   * Returns an array of `ProjectConfig`s or `null`s corresponding to the
   * `projectConfigPaths` argument. If a hocus config file is not present in a directory,
   * `null` is returned.
   */
  async checkoutAndInspect(args: {
    fcService: FirecrackerService;
    /** Should point to the output of `fetchRepository` on host */
    repositoryDrivePath: string;
    /** The repository will be checked out to this branch. */
    targetBranch: string;
    /** A new drive will be created at this path on host. */
    outputDrivePath: string;
    /** Relative paths to directories where `hocus.yml` files are located in the repository. */
    projectConfigPaths: string[];
  }): Promise<({ projectConfig: ProjectConfig; imageFileHash: string } | null)[]> {
    if (await doesFileExist(args.outputDrivePath)) {
      this.logger.warn(
        `output drive already exists at "${args.outputDrivePath}", it will be overwritten`,
      );
    }
    await fs.mkdir(path.dirname(args.outputDrivePath), { recursive: true });
    await fs.copyFile(args.repositoryDrivePath, args.outputDrivePath);
    const workdir = "/tmp/workdir";
    try {
      return await args.fcService.withVM(
        {
          ssh: {
            username: "hocus",
            privateKey: this.agentConfig.prebuildSshPrivateKey,
          },
          kernelPath: this.agentConfig.defaultKernel,
          rootFsPath: this.agentConfig.checkoutAndInspectRootFs,
          extraDrives: [{ pathOnHost: args.outputDrivePath, guestMountPath: workdir }],
        },
        async ({ ssh }) => {
          const repoPath = `${workdir}/project`;

          await execSshCmd({ ssh, opts: { cwd: repoPath } }, [
            "git",
            "checkout",
            args.targetBranch,
          ]);
          const configs: (ProjectConfig | null)[] = await waitForPromises(
            args.projectConfigPaths.map((p) =>
              this.projectConfigService.getConfig(ssh, repoPath, p),
            ),
          );
          const imageFileHashes = await waitForPromises(
            configs.map((c) =>
              c === null ? null : this.agentUtilService.readFile(ssh, c.image.file),
            ),
          );
          return configs.map((c, idx) => {
            if (c === null) {
              return null;
            }
            return {
              projectConfig: c,
              imageFileHash: sha256(unwrap(imageFileHashes[idx])),
            };
          });
        },
      );
    } catch (err) {
      await fs.unlink(args.outputDrivePath);
      throw err;
    }
  }

  async createCheckoutAndInspectFile(
    db: Prisma.TransactionClient,
    prebuildEventId: bigint,
    outputDrivePath: string,
  ): Promise<void> {
    const agentInstance = await this.agentUtilService.getOrCreateSoloAgentInstance(db);
    const fsFile = await db.file.create({
      data: {
        path: outputDrivePath,
        agentInstanceId: agentInstance.id,
      },
    });
    await db.prebuildEvent.update({
      where: { id: prebuildEventId },
      data: {
        fsFileId: fsFile.id,
      },
    });
  }
}
