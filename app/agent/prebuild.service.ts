import fs from "fs/promises";
import path from "path";

import type {
  PrebuildEvent,
  PrebuildEventFiles,
  PrebuildEventReservation,
  Prisma,
  Project,
  VmTask,
} from "@prisma/client";
import { PrebuildEventReservationType } from "@prisma/client";
import { VmTaskStatus } from "@prisma/client";
import { PrebuildEventStatus } from "@prisma/client";
import type { Logger } from "@temporalio/worker";
import { P, match } from "ts-pattern";

import type { AgentUtilService } from "./agent-util.service";
import type { VMTaskOutput } from "./agent-util.types";
import type { BuildfsService } from "./buildfs.service";
import {
  HOST_PERSISTENT_DIR,
  SOLO_AGENT_INSTANCE_ID,
  WORKSPACE_ENV_SCRIPT_PATH,
} from "./constants";
import {
  PREBUILD_DEV_DIR,
  PREBUILD_SCRIPTS_DIR,
  PREBUILD_REPOSITORY_DIR,
  SUCCESSFUL_PREBUILD_STATES,
  UNSUCCESSFUL_PREBUILD_STATES,
} from "./prebuild-constants";
import type { ProjectConfigService } from "./project-config/project-config.service";
import type { ProjectConfig } from "./project-config/validator";
import type { FirecrackerService } from "./runtime/firecracker-legacy/firecracker.service";
import { doesFileExist, execCmd, execSshCmd, sha256, withFileLock } from "./utils";

import type { Config } from "~/config";
import type { PerfService } from "~/perf.service.server";
import { ValidationError } from "~/schema/utils.server";
import { Token } from "~/token";
import { displayError, mapOverNull, unwrap, waitForPromises } from "~/utils.shared";

export class PrebuildService {
  static inject = [
    Token.Logger,
    Token.AgentUtilService,
    Token.ProjectConfigService,
    Token.BuildfsService,
    Token.PerfService,
    Token.Config,
  ] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly logger: Logger,
    private readonly agentUtilService: AgentUtilService,
    private readonly projectConfigService: ProjectConfigService,
    private readonly buildfsService: BuildfsService,
    private readonly perfService: PerfService,
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
    args: { projectId: bigint; gitObjectId: bigint; externalId?: string; archiveAfter?: Date },
  ): Promise<PrebuildEvent & { project: Project }> {
    const { projectId, gitObjectId, archiveAfter } = args;
    const data = {
      projectId,
      gitObjectId,
      status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_INIT,
      archiveAfter,
    } as const;
    if (args.externalId != null) {
      return await db.prebuildEvent.upsert({
        create: {
          ...data,
          externalId: args.externalId,
        },
        update: {},
        where: {
          externalId: args.externalId,
        },
        include: { project: true },
      });
    }
    return await db.prebuildEvent.create({ data, include: { project: true } });
  }

  async initPrebuildEvent(
    db: Prisma.TransactionClient,
    args: {
      prebuildEventId: bigint;
      buildfsEventId: bigint | null;
      workspaceTasks: { command: string; commandShell: string }[];
      tasks: {
        command: string;
        cwd: string;
      }[];
    },
  ): Promise<PrebuildEvent> {
    await Promise.all(
      args.tasks.map(async ({ command, cwd }, idx) => {
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
            prebuildEventId: args.prebuildEventId,
            vmTaskId: vmTask.id,
            idx,
            originalCommand: command,
          },
        });
      }),
    );
    return await db.prebuildEvent.update({
      where: { id: args.prebuildEventId },
      data: {
        status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_READY,
        buildfsEventId: args.buildfsEventId,
        workspaceTasksCommand: args.workspaceTasks.map((x) => x.command),
        workspaceTasksShell: args.workspaceTasks.map((x) => x.commandShell),
      },
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
      execCmd("cp", "--sparse=always", args.sourceProjectDrivePath, args.outputProjectDrivePath),
      execCmd("cp", "--sparse=always", args.sourceFsDrivePath, args.outputFsDrivePath),
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

  /** Does not throw if files don't exist. */
  async removeLocalPrebuildEventFiles(args: {
    projectDrivePath: string;
    fsDrivePath: string;
  }): Promise<void> {
    const files = [args.projectDrivePath, args.fsDrivePath];
    await waitForPromises(
      files.map((f) =>
        fs.unlink(f).catch((err) => {
          if (err?.code === "ENOENT") {
            this.logger.warn(`File ${f} does not exist`);
          } else {
            throw err;
          }
        }),
      ),
    );
  }

  /**
   * Copies the contents of `repositoryDrivePath` into `outputDrivePath`, and checks
   * out the given branch there.
   *
   * Returns an array of `ProjectConfig`s, `null`s, or validation errors corresponding to the
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
  }): Promise<
    ({ projectConfig: ProjectConfig; imageFileHash: string | null } | null | ValidationError)[]
  > {
    if (await doesFileExist(args.outputDrivePath)) {
      this.logger.warn(
        `output drive already exists at "${args.outputDrivePath}", it will be overwritten`,
      );
    }
    await fs.mkdir(path.dirname(args.outputDrivePath), { recursive: true });
    await withFileLock(args.repositoryDrivePath, async () => {
      await execCmd("cp", "--sparse=always", args.repositoryDrivePath, args.outputDrivePath);
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
          memSizeMib: 4096,
          vcpuCount: 2,
        },
        async ({ ssh }) => {
          const repoPath = `${workdir}/project`;

          await execSshCmd({ ssh, opts: { cwd: repoPath } }, [
            "git",
            "checkout",
            args.targetBranch,
          ]);
          const configs: (ProjectConfig | null | ValidationError)[] = mapOverNull(
            await waitForPromises(
              args.projectConfigPaths.map((p) =>
                this.projectConfigService.getConfig(ssh, repoPath, p),
              ),
            ),
            (c) => {
              if (c instanceof ValidationError || c == null) {
                return c;
              }
              return c[0];
            },
          );
          return await waitForPromises(
            configs.map(async (config, idx) => {
              if (config == null || config instanceof ValidationError) {
                return config;
              }
              const pathToImageFile = path.join(
                repoPath,
                args.projectConfigPaths[idx],
                config.image.file,
              );
              const imageFile = await this.agentUtilService.readFile(ssh, pathToImageFile);
              let externalFilesHash: null | string = null;
              try {
                const externalFilesPaths =
                  this.buildfsService.getExternalFilePathsFromDockerfile(imageFile);
                const absoluteFilePaths = externalFilesPaths.map((p) =>
                  path.join(repoPath, args.projectConfigPaths[idx], config.image.buildContext, p),
                );
                externalFilesHash = await this.buildfsService.getSha256FromFiles(
                  ssh,
                  repoPath,
                  absoluteFilePaths,
                );
              } catch (err) {
                this.logger.error(displayError(err));
              }
              const imageFileHash = sha256(imageFile);

              return {
                projectConfig: config,
                imageFileHash:
                  externalFilesHash === null ? null : imageFileHash + externalFilesHash,
              };
            }),
          );
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

  async reservePrebuildEvent(
    db: Prisma.TransactionClient,
    prebuildEventId: bigint,
    reservationType: PrebuildEventReservationType,
    validUntil: Date,
    reservationExternalId?: string,
  ): Promise<PrebuildEventReservation> {
    await db.$executeRaw`SELECT id FROM "PrebuildEventReservation" WHERE id = ${prebuildEventId} FOR UPDATE`;
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: prebuildEventId },
      include: {
        reservations: {
          where: {
            type: PrebuildEventReservationType.PREBUILD_EVENT_RESERVATION_TYPE_ARCHIVE_PREBUILD,
            validUntil: { gt: new Date() },
          },
        },
      },
    });
    if (prebuildEvent.reservations.length > 0) {
      throw new Error(`Prebuild event ${prebuildEventId} has an archive prebuild reservation`);
    }
    return await db.prebuildEventReservation.create({
      data: {
        type: reservationType,
        externalId: reservationExternalId,
        validUntil,
        prebuildEventId,
      },
    });
  }

  /**
   * Returns all prebuild events that are older than the latest successful prebuild event for the same branch,
   * except that if a prebuild event is the latest on one branch, but not on another, it will not be returned.
   */
  async getArchivablePrebuildEvents(
    db: Prisma.Client,
    projectId: bigint,
  ): Promise<PrebuildEvent[]> {
    type QueryResult = { r: bigint; prebuildEventId: bigint; isArchivable: boolean }[];
    const prebuildEventIds = await db.$queryRaw<QueryResult>`
      SELECT
        x."r",
        x."prebuildEventId",
        x."archiveAfter" < NOW() AS "isArchivable"
      FROM (
        SELECT
          ROW_NUMBER() OVER (
            PARTITION BY t."gitBranchId" ORDER BY
              t."gitObjectCreatedAt" DESC,
              t."prebuildCreatedAt" DESC,
              t."prebuildEventId" DESC
          ) AS r,
          t.*
        FROM (
          SELECT
            p."id" AS "prebuildEventId",
            g2b."gitBranchId",
            p."createdAt" AS "prebuildCreatedAt",
            g."createdAt" AS "gitObjectCreatedAt",
            p."archiveAfter"
          FROM "PrebuildEvent" AS p
          INNER JOIN "GitObjectToBranch" AS g2b ON p."gitObjectId" = g2b."gitObjectId"
          INNER JOIN "GitObject" AS g ON p."gitObjectId" = g."id"
          WHERE
            p."projectId" = ${projectId} AND
            p."status" = 'PREBUILD_EVENT_STATUS_SUCCESS'::"PrebuildEventStatus"
          ORDER BY p."createdAt" DESC
        ) AS t
      ) AS x;
    `;
    const latestPrebuildEventIds = new Set(
      prebuildEventIds.filter((e) => e.r === BigInt(1)).map((e) => e.prebuildEventId),
    );
    const prebuildEventIdsToArchive = prebuildEventIds
      .filter((e) => !latestPrebuildEventIds.has(e.prebuildEventId) && e.isArchivable)
      .map((e) => e.prebuildEventId);
    const prebuildEvents = await db.prebuildEvent.findMany({
      where: { id: { in: prebuildEventIdsToArchive } },
    });
    return prebuildEvents;
  }

  /** Returns all archived prebuild events that have no workspaces associated with them and are at least 48 hours old. */
  async getRemovablePrebuildEvents(
    db: Prisma.Client,
    projectId: bigint,
    now: Date,
  ): Promise<PrebuildEvent[]> {
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return await db.prebuildEvent.findMany({
      where: {
        projectId,
        status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_ARCHIVED,
        createdAt: { lt: fortyEightHoursAgo },
        workspaces: {
          // This filter ensures that the prebuild event has no workspaces associated with it.
          none: {},
        },
      },
    });
  }

  async removePrebuildEventFromDb(
    db: Prisma.TransactionClient,
    prebuildEventId: bigint,
  ): Promise<void> {
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: prebuildEventId },
      include: {
        tasks: {
          include: {
            vmTask: true,
          },
        },
      },
    });
    if (prebuildEvent.status !== PrebuildEventStatus.PREBUILD_EVENT_STATUS_ARCHIVED) {
      throw new Error(`Prebuild event ${prebuildEventId} is not archived`);
    }
    const logGroupIds = prebuildEvent.tasks.map((t) => t.vmTask.logGroupId);
    await db.log.deleteMany({
      where: { logGroupId: { in: logGroupIds } },
    });
    await db.prebuildEventTask.deleteMany({
      where: { prebuildEventId },
    });
    await db.vmTask.deleteMany({
      where: { id: { in: prebuildEvent.tasks.map((t) => t.vmTaskId) } },
    });
    await db.logGroup.deleteMany({
      where: { id: { in: logGroupIds } },
    });
    await db.prebuildEventSystemError.deleteMany({ where: { prebuildEventId } });
    await db.prebuildEvent.delete({ where: { id: prebuildEventId } });
  }

  private async cleanupDbAfterVmTaskError(
    db: Prisma.TransactionClient,
    vmTask: VmTask,
  ): Promise<void> {
    const quitNow = match(vmTask.status)
      .with(
        P.union(
          VmTaskStatus.VM_TASK_STATUS_ERROR,
          VmTaskStatus.VM_TASK_STATUS_SUCCESS,
          VmTaskStatus.VM_TASK_STATUS_CANCELLED,
        ),
        () => true,
      )
      .with(
        P.union(VmTaskStatus.VM_TASK_STATUS_PENDING, VmTaskStatus.VM_TASK_STATUS_RUNNING),
        () => false,
      )
      .exhaustive();
    if (quitNow) {
      return;
    }
    await db.vmTask.update({
      where: { id: vmTask.id },
      data: {
        status: VmTaskStatus.VM_TASK_STATUS_CANCELLED,
      },
    });
  }

  async cleanupDbAfterPrebuildError(args: {
    db: Prisma.TransactionClient;
    prebuildEventId: bigint;
    errorMessage?: string;
    cancelled: boolean;
  }): Promise<void> {
    const { db, prebuildEventId, errorMessage, cancelled } = args;

    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: prebuildEventId },
      include: {
        buildfsEvent: {
          include: {
            vmTask: true,
          },
        },
        tasks: {
          include: {
            vmTask: true,
          },
        },
      },
    });
    const quitNow = match(prebuildEvent.status)
      .with(P.union(...SUCCESSFUL_PREBUILD_STATES), () => true)
      .with(P.union(...UNSUCCESSFUL_PREBUILD_STATES), () => false)
      .exhaustive();
    if (quitNow) {
      return;
    }
    let vmTasks: VmTask[] = prebuildEvent.tasks.map((t) => t.vmTask);
    if (prebuildEvent.buildfsEvent != null) {
      vmTasks.push(prebuildEvent.buildfsEvent.vmTask);
    }
    await waitForPromises(vmTasks.map((t) => this.cleanupDbAfterVmTaskError(db, t)));

    await db.prebuildEvent.update({
      where: { id: prebuildEventId },
      data: {
        status: cancelled
          ? PrebuildEventStatus.PREBUILD_EVENT_STATUS_CANCELLED
          : PrebuildEventStatus.PREBUILD_EVENT_STATUS_ERROR,
      },
    });
    if (errorMessage != null) {
      await db.prebuildEventSystemError.create({
        data: {
          prebuildEventId,
          message: errorMessage,
        },
      });
    }
  }

  /**
   * Returns the result for every task.
   *
   * Assumes that there is a `hocus` user with passwordless sudo on the
   * filesystem drive, sshd is configured to start running automatically after VM boot,
   * and the corresponding public key to the private key used to connect to the VM
   * (`agentConfig.prebuildSshPrivateKey`) is already present in the `hocus` user's authorized_keys.
   */
  async prebuild(
    db: Prisma.NonTransactionClient,
    firecrackerService: FirecrackerService,
    prebuildEventId: bigint,
  ): Promise<VMTaskOutput[]> {
    this.perfService.log("prebuild", "start", prebuildEventId);
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: prebuildEventId },
      include: {
        tasks: { include: { vmTask: true } },
        prebuildEventFiles: { include: { agentInstance: true, fsFile: true, projectFile: true } },
        project: {
          include: {
            environmentVariableSet: {
              include: {
                environmentVariables: true,
              },
            },
          },
        },
      },
    });
    const prebuildEventFiles = unwrap(
      prebuildEvent.prebuildEventFiles.find(
        (f) => f.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    );
    const envVariables = prebuildEvent.project.environmentVariableSet.environmentVariables.map(
      (v) => ({
        name: v.name,
        value: v.value,
      }),
    );
    const tasks = prebuildEvent.tasks;
    const result = await firecrackerService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: this.agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: this.agentConfig.defaultKernel,
        rootFsPath: prebuildEventFiles.fsFile.path,
        extraDrives: [
          {
            pathOnHost: prebuildEventFiles.projectFile.path,
            guestMountPath: this.devDir,
          },
        ],
        memSizeMib: prebuildEvent.project.maxPrebuildRamMib,
        vcpuCount: prebuildEvent.project.maxPrebuildVCPUCount,
      },
      async ({ ssh, sshConfig }) => {
        const envScript = this.agentUtilService.generateEnvVarsScript(envVariables);
        await execSshCmd({ ssh }, ["mkdir", "-p", path.dirname(WORKSPACE_ENV_SCRIPT_PATH)]);
        await this.agentUtilService.writeFile(ssh, WORKSPACE_ENV_SCRIPT_PATH, envScript);
        await Promise.all(
          tasks.map(async (task) => {
            const script = this.agentUtilService.generatePrebuildTaskScript(task.originalCommand);
            const paths = this.getPrebuildTaskPaths(task.idx);
            await execSshCmd({ ssh }, ["mkdir", "-p", this.prebuildScriptsDir]);
            await this.agentUtilService.writeFile(ssh, paths.scriptPath, script);
          }),
        );

        return await this.agentUtilService.execVmTasks(
          sshConfig,
          db,
          tasks.map((t) => ({
            vmTaskId: t.vmTask.id,
          })),
        );
      },
    );
    this.perfService.log("prebuild", "end", prebuildEventId);
    return result;
  }
}
