import fs from "fs/promises";
import path from "path";

import type { PrebuildEvent, PrebuildEventFiles, Prisma } from "@prisma/client";
import { VmTaskStatus } from "@prisma/client";
import { PrebuildEventStatus } from "@prisma/client";
import type { Logger } from "@temporalio/worker";
import type { Config } from "~/config";
import { Token } from "~/token";
import { displayError, mapOverNull, unwrap, waitForPromises } from "~/utils.shared";

import type { AgentUtilService } from "./agent-util.service";
import type { BuildfsService } from "./buildfs.service";
import { HOST_PERSISTENT_DIR } from "./constants";
import type { FirecrackerService } from "./firecracker.service";
import {
  PREBUILD_DEV_DIR,
  PREBUILD_SCRIPTS_DIR,
  PREBUILD_REPOSITORY_DIR,
} from "./prebuild-constants";
import type { ProjectConfigService } from "./project-config/project-config.service";
import type { ProjectConfig } from "./project-config/validator";
import { doesFileExist, execSshCmd, sha256, withFileLock } from "./utils";

export class PrebuildService {
  static inject = [
    Token.Logger,
    Token.AgentUtilService,
    Token.ProjectConfigService,
    Token.BuildfsService,
    Token.Config,
  ] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly logger: Logger,
    private readonly agentUtilService: AgentUtilService,
    private readonly projectConfigService: ProjectConfigService,
    private readonly buildfsService: BuildfsService,
    config: Config,
  ) {
    this.agentConfig = config.agent();
  }

  devDir = PREBUILD_DEV_DIR;
  repositoryDir = PREBUILD_REPOSITORY_DIR;
  prebuildScriptsDir = PREBUILD_SCRIPTS_DIR;

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
    buildfsEventId: bigint | null,
    workspaceTasks: {command: string, commandShell: string}[],
    tasks: {
      command: string;
      cwd: string;
    }[],
  ): Promise<PrebuildEvent> {
    const prebuildEvent = await db.prebuildEvent.create({
      data: {
        projectId,
        gitObjectId,
        buildfsEventId,
        status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING,
        workspaceTasksCommand: workspaceTasks.map((x) => x.command),
        workspaceTasksShell: workspaceTasks.map((x) => x.commandShell),
      },
    });
    await Promise.all(
      tasks.map(async ({ command, cwd }, idx) => {
        const paths = this.getPrebuildTaskPaths(idx);
        const vmTask = await this.agentUtilService.createVmTask(db, {
          command: [
            "bash",
            "-o",
            "pipefail",
            "-o",
            "errexit",
            "-o",
            "allexport",
            "-c",
            `bash "${paths.scriptPath}" 2>&1 | tee "${paths.logPath}"`,
          ],
          cwd,
        });
        await db.prebuildEventTask.create({
          data: {
            prebuildEventId: prebuildEvent.id,
            vmTaskId: vmTask.id,
            idx,
            originalCommand: command,
          },
        });
      }),
    );
    return prebuildEvent;
  }

  async linkGitBranchesToPrebuildEvent(
    db: Prisma.TransactionClient,
    prebuildEventId: bigint,
    gitBranchIds: bigint[],
  ) {
    await db.prebuildEventToGitBranch.createMany({
      data: gitBranchIds.map((gitBranchId) => ({
        prebuildEventId,
        gitBranchId,
      })),
    });
  }

  async getSourceFsDrivePath(
    db: Prisma.Client,
    prebuildEventId: bigint,
    agentInstanceId: bigint,
  ): Promise<string> {
    let sourceFsDrivePath: string;
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: prebuildEventId },
      include: {
        buildfsEvent: {
          include: { buildfsEventFiles: { include: { outputFile: true } } },
        },
      },
    });
    if (prebuildEvent.buildfsEvent != null) {
      const buildfsEvent = prebuildEvent.buildfsEvent;
      sourceFsDrivePath = unwrap(
        buildfsEvent.buildfsEventFiles.find((f) => f.agentInstanceId === agentInstanceId),
      ).outputFile.path;
    } else {
      sourceFsDrivePath = this.agentConfig.defaultWorkspaceRootFs;
    }
    return sourceFsDrivePath;
  }

  async createLocalPrebuildEventFiles(args: {
    sourceProjectDrivePath: string;
    outputProjectDrivePath: string;
    sourceFsDrivePath: string;
    outputFsDrivePath: string;
  }): Promise<void> {
    await waitForPromises([
      fs.mkdir(path.dirname(args.outputProjectDrivePath), { recursive: true }),
      fs.mkdir(path.dirname(args.outputFsDrivePath), { recursive: true }),
    ]);
    await waitForPromises([
      fs.copyFile(args.sourceProjectDrivePath, args.outputProjectDrivePath),
      fs.copyFile(args.sourceFsDrivePath, args.outputFsDrivePath),
    ]);
  }

  async createDbPrebuildEventFiles(
    db: Prisma.TransactionClient,
    args: {
      outputProjectDrivePath: string;
      outputFsDrivePath: string;
      agentInstanceId: bigint;
      prebuildEventId: bigint;
    },
  ): Promise<PrebuildEventFiles> {
    const fsFile = await db.file.create({
      data: {
        agentInstanceId: args.agentInstanceId,
        path: args.outputFsDrivePath,
      },
    });
    const projectFile = await db.file.create({
      data: {
        agentInstanceId: args.agentInstanceId,
        path: args.outputProjectDrivePath,
      },
    });
    return await db.prebuildEventFiles.create({
      data: {
        prebuildEventId: args.prebuildEventId,
        fsFileId: fsFile.id,
        projectFileId: projectFile.id,
        agentInstanceId: args.agentInstanceId,
      },
    });
  }

  async createPrebuildEventFiles(
    db: Prisma.NonTransactionClient,
    args: {
      sourceProjectDrivePath: string;
      agentInstanceId: bigint;
      prebuildEventId: bigint;
    },
  ): Promise<PrebuildEventFiles> {
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: args.prebuildEventId },
    });
    const outputFsDrivePath = path.join(
      HOST_PERSISTENT_DIR,
      "fs",
      `${prebuildEvent.externalId}.ext4`,
    );
    const outputProjectDrivePath = path.join(
      HOST_PERSISTENT_DIR,
      "project",
      `${prebuildEvent.externalId}.ext4`,
    );
    const sourceFsDrivePath = await this.getSourceFsDrivePath(
      db,
      args.prebuildEventId,
      args.agentInstanceId,
    );
    await this.createLocalPrebuildEventFiles({
      sourceFsDrivePath,
      sourceProjectDrivePath: args.sourceProjectDrivePath,
      outputProjectDrivePath,
      outputFsDrivePath,
    });
    return await db.$transaction((tdb) =>
      this.createDbPrebuildEventFiles(tdb, {
        outputProjectDrivePath,
        outputFsDrivePath,
        agentInstanceId: args.agentInstanceId,
        prebuildEventId: args.prebuildEventId,
      }),
    );
  }

  /**
   * Creates a prebuild event and links all git branches that point to the given git object id to it.
   */
  async preparePrebuild(
    db: Prisma.TransactionClient,
    args: {
      agentInstanceId: bigint;
      projectId: bigint;
      gitObjectId: bigint;
      gitBranchIds: bigint[];
      /** Null if project configuration was not found or did not include image config. */
      buildfsEventId: bigint | null;
      tasks: { command: string; cwd: string }[];
      workspaceTasks: {command: string, commandShell: string}[];
    },
  ): Promise<PrebuildEvent> {
    const prebuildEvent = await this.createPrebuildEvent(
      db,
      args.projectId,
      args.gitObjectId,
      args.buildfsEventId,
      args.workspaceTasks,
      args.tasks,
    );
    await this.linkGitBranchesToPrebuildEvent(db, prebuildEvent.id, args.gitBranchIds);
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
  }): Promise<({ projectConfig: ProjectConfig; imageFileHash: string | null } | null)[]> {
    if (await doesFileExist(args.outputDrivePath)) {
      this.logger.warn(
        `output drive already exists at "${args.outputDrivePath}", it will be overwritten`,
      );
    }
    await fs.mkdir(path.dirname(args.outputDrivePath), { recursive: true });
    await withFileLock(args.repositoryDrivePath, async () => {
      await fs.copyFile(args.repositoryDrivePath, args.outputDrivePath);
    });
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
          copyRootFs: true,
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
          const imageFiles = await waitForPromises(
            mapOverNull(configs, (c, idx) => {
              const pathToImageFile = path.join(
                repoPath,
                args.projectConfigPaths[idx],
                c.image.file,
              );
              return this.agentUtilService.readFile(ssh, pathToImageFile);
            }),
          );
          const externalFilePaths = await waitForPromises(
            mapOverNull(imageFiles, (fileContent) => {
              try {
                return this.buildfsService.getExternalFilePathsFromDockerfile(fileContent);
              } catch (err) {
                this.logger.error(displayError(err));
                return null;
              }
            }),
          );
          const externalFilesHashes = await waitForPromises(
            mapOverNull(externalFilePaths, (filePaths, idx) => {
              const absoluteFilePaths = filePaths.map((p) =>
                path.join(
                  repoPath,
                  args.projectConfigPaths[idx],
                  unwrap(configs[idx]).image.buildContext,
                  p,
                ),
              );
              return this.buildfsService.getSha256FromFiles(ssh, repoPath, absoluteFilePaths);
            }),
          );
          return mapOverNull(configs, (c, idx) => {
            const imageFileHash = sha256(unwrap(imageFiles[idx]));
            const externalFilesHash = externalFilesHashes[idx];
            return {
              projectConfig: c,
              imageFileHash: externalFilesHash === null ? null : imageFileHash + externalFilesHash,
            };
          });
        },
      );
    } catch (err) {
      await fs.unlink(args.outputDrivePath);
      throw err;
    }
  }

  async changePrebuildEventStatus(
    db: Prisma.Client,
    prebuildEventId: bigint,
    status: PrebuildEventStatus,
  ): Promise<void> {
    await db.prebuildEvent.update({
      where: { id: prebuildEventId },
      data: { status },
    });
  }

  async cancelPrebuilds(db: Prisma.TransactionClient, prebuildEventIds: bigint[]): Promise<void> {
    const updatedPrebuildEventsCount = await db.prebuildEvent.updateMany({
      where: { id: { in: prebuildEventIds } },
      data: { status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_CANCELLED },
    });
    if (updatedPrebuildEventsCount.count !== prebuildEventIds.length) {
      throw new Error(
        `Updated ${updatedPrebuildEventsCount.count} rows, expected ${prebuildEventIds.length}`,
      );
    }
    const prebuildEvents = await db.prebuildEvent.findMany({
      where: { id: { in: prebuildEventIds } },
      include: { tasks: true },
    });
    const taskIds = prebuildEvents.flatMap((e) => e.tasks.map((t) => t.vmTaskId));

    await db.vmTask.updateMany({
      where: {
        id: { in: taskIds },
      },
      data: { status: VmTaskStatus.VM_TASK_STATUS_CANCELLED },
    });
  }
}
