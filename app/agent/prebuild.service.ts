import path from "path";

import type {
  PrebuildEvent,
  PrebuildEventImages,
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
import { v4 as uuidv4 } from "uuid";

import type { AgentUtilService } from "./agent-util.service";
import type { VMTaskOutput } from "./agent-util.types";
import type { ContainerId, ImageId } from "./block-registry/registry.service";
import { BlockRegistryService } from "./block-registry/registry.service";
import { EXPOSE_METHOD } from "./block-registry/registry.service";
import { withExposedImages } from "./block-registry/utils";
import type { BuildfsService } from "./buildfs.service";
import { WORKSPACE_ENV_SCRIPT_PATH } from "./constants";
import {
  PREBUILD_DEV_DIR,
  PREBUILD_SCRIPTS_DIR,
  PREBUILD_REPOSITORY_DIR,
  SUCCESSFUL_PREBUILD_STATES,
  UNSUCCESSFUL_PREBUILD_STATES,
} from "./prebuild-constants";
import type { ProjectConfigService } from "./project-config/project-config.service";
import type { ProjectConfig } from "./project-config/validator";
import type { HocusRuntime } from "./runtime/hocus-runtime";
import { LocalLockNamespace, execSshCmd, withLocalLock } from "./utils";

import type { Config } from "~/config";
import type { PerfService } from "~/perf.service.server";
import { ValidationError } from "~/schema/utils.server";
import { Token } from "~/token";
import { sha256 } from "~/utils.server";
import { displayError, mapOverNull, waitForPromises } from "~/utils.shared";

export class PrebuildService {
  static inject = [
    Token.Logger,
    Token.AgentUtilService,
    Token.ProjectConfigService,
    Token.BuildfsService,
    Token.PerfService,
    Token.BlockRegistryService,
    Token.Config,
  ] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly logger: Logger,
    private readonly agentUtilService: AgentUtilService,
    private readonly projectConfigService: ProjectConfigService,
    private readonly buildfsService: BuildfsService,
    private readonly perfService: PerfService,
    private readonly brService: BlockRegistryService,
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

  async createPrebuildVmTasks(
    db: Prisma.TransactionClient,
    tasks: {
      cwd: string;
    }[],
  ): Promise<VmTask[]> {
    return waitForPromises(
      tasks.map(async ({ cwd }, idx) => {
        const paths = this.getPrebuildTaskPaths(idx);
        return this.agentUtilService.createVmTask(db, {
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
      }),
    );
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
    const vmTasks = await this.createPrebuildVmTasks(db, args.tasks);
    await waitForPromises(
      args.tasks.map(({ command }, idx) =>
        db.prebuildEventTask.create({
          data: {
            prebuildEventId: args.prebuildEventId,
            vmTaskId: vmTasks[idx].id,
            idx,
            originalCommand: command,
          },
        }),
      ),
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

  async createPrebuildEventImagesInDb(
    db: Prisma.TransactionClient,
    args: {
      outputProjectImageTag: string;
      outputFsImageTag: string;
      agentInstanceId: bigint;
      prebuildEventId: bigint;
    },
  ): Promise<PrebuildEventImages> {
    return db.prebuildEventImages.create({
      data: {
        prebuildEvent: {
          connect: { id: args.prebuildEventId },
        },
        agentInstance: { connect: { id: args.agentInstanceId } },
        fsImage: {
          create: {
            tag: args.outputFsImageTag,
            agentInstance: {
              connect: { id: args.agentInstanceId },
            },
            readonly: true,
          },
        },
        projectImage: {
          create: {
            tag: args.outputProjectImageTag,
            agentInstance: {
              connect: { id: args.agentInstanceId },
            },
            readonly: true,
          },
        },
        fsImageAgentMatch: {},
        projectImageAgentMatch: {},
      },
    });
  }

  async createLocalPrebuildEventImages(args: {
    projectImageId: ImageId;
    fsImageId: ImageId;
    projectOutputId: string;
    fsOutputId: string;
  }): Promise<{ fsContainerId: ContainerId; projectContainerId: ContainerId }> {
    const [fsContainerId, projectContainerId] = await waitForPromises(
      (
        [
          [args.fsImageId, args.fsOutputId],
          [args.projectImageId, args.projectOutputId],
        ] as const
      ).map(([imageId, outputId]) => this.brService.createContainer(imageId, outputId)),
    );
    return { fsContainerId, projectContainerId };
  }

  /**
   * Creates a new image based on the `repoImageTag` image with an id created from `outputId`,
   * checks out the repository to the `targetBranch` branch, and returns the `hocus.yml` files
   * in the `projectConfigPaths`
   *
   * Returns an array of `ProjectConfig`s, `null`s, or validation errors corresponding to the
   * `projectConfigPaths` argument. If a hocus config file is not present in a directory,
   * `null` is returned.
   */
  async checkoutAndInspect(args: {
    runtime: HocusRuntime;
    /** The id of the container with the git repository */
    repoContainerId: ContainerId;
    /** The repository will be checked out to this branch. */
    targetBranch: string;
    /** A new image will be created from this output id. */
    outputId: string;
    /** Relative paths to directories where `hocus.yml` files are located in the repository. */
    projectConfigPaths: string[];
  }): Promise<
    ({ projectConfig: ProjectConfig; imageFileHash: string | null } | null | ValidationError)[]
  > {
    const tmpOutputId = `tmp-${sha256(args.outputId)}`;
    const tmpOutputImageId = await withLocalLock(
      LocalLockNamespace.CONTAINER,
      args.repoContainerId,
      async () => {
        return this.brService.commitContainer(args.repoContainerId, tmpOutputId, {
          removeContainer: false,
        });
      },
    );
    const outputContainerId = await this.brService.createContainer(tmpOutputImageId, args.outputId);
    // TODO: remove the tmpOutputImage once the block registry allows it

    const localRootFsImageTag = sha256(this.agentConfig.checkoutOutputId);
    const rootFsImageId = BlockRegistryService.genImageId(localRootFsImageTag);
    if (!(await this.brService.hasImage(rootFsImageId))) {
      await this.brService.loadImageFromRemoteRepo(
        this.agentConfig.checkoutOutputId,
        localRootFsImageTag,
      );
    }
    const rootFsContainerTag = uuidv4();
    // TODO: delete this container once the block registry allows it
    const rootFsContainerId = await this.brService.createContainer(
      rootFsImageId,
      rootFsContainerTag,
    );
    const workdir = "/workdir";
    const result = await withExposedImages(
      this.brService,
      [
        [rootFsContainerId, EXPOSE_METHOD.BLOCK_DEV],
        [outputContainerId, EXPOSE_METHOD.BLOCK_DEV],
      ] as const,
      async ([rootFsSpec, workdirFsSpec]) =>
        args.runtime.withRuntime(
          {
            ssh: {
              username: "hocus",
              password: "hocus",
            },
            fs: {
              "/": rootFsSpec,
              [workdir]: workdirFsSpec,
            },
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
        ),
    );
    await this.brService.commitContainer(outputContainerId, args.outputId);
    return result;
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
  async prebuild(args: {
    db: Prisma.NonTransactionClient;
    runtime: HocusRuntime;
    envVariables: { name: string; value: string }[];
    tasks: { idx: number; originalCommand: string; vmTaskId: bigint }[];
    rootFsImageId: ImageId;
    projectImageId: ImageId;
    /** A new image will be created from this output id */
    outputRootFsId: string;
    /** A new image will be created from this output id */
    outputProjectId: string;
    memSizeMib: number;
    vcpuCount: number;
  }): Promise<VMTaskOutput[]> {
    const {
      db,
      runtime,
      envVariables,
      tasks,
      rootFsImageId,
      projectImageId,
      outputRootFsId,
      outputProjectId,
      memSizeMib,
      vcpuCount,
    } = args;
    this.perfService.log("prebuild", "start", outputRootFsId);
    const [rootFsContainerId, projectContainerId] = await waitForPromises(
      (
        [
          [rootFsImageId, outputRootFsId],
          [projectImageId, outputProjectId],
        ] as const
      ).map(([imageId, outputId]) => this.brService.createContainer(imageId, outputId)),
    );
    const result = await withExposedImages(
      this.brService,
      [
        [rootFsContainerId, EXPOSE_METHOD.BLOCK_DEV],
        [projectContainerId, EXPOSE_METHOD.BLOCK_DEV],
      ] as const,
      ([rootFsSpec, projectFsSpec]) =>
        runtime.withRuntime(
          {
            ssh: {
              username: "hocus",
              privateKey: this.agentConfig.prebuildSshPrivateKey,
            },
            fs: {
              "/": rootFsSpec,
              [this.devDir]: projectFsSpec,
            },
            memSizeMib,
            vcpuCount,
          },
          async ({ ssh, sshConfig }) => {
            const envScript = this.agentUtilService.generateEnvVarsScript(envVariables);
            await execSshCmd({ ssh }, ["mkdir", "-p", path.dirname(WORKSPACE_ENV_SCRIPT_PATH)]);
            await this.agentUtilService.writeFile(ssh, WORKSPACE_ENV_SCRIPT_PATH, envScript);
            await waitForPromises(
              tasks.map(async (task) => {
                const script = this.agentUtilService.generatePrebuildTaskScript(
                  task.originalCommand,
                );
                const paths = this.getPrebuildTaskPaths(task.idx);
                await execSshCmd({ ssh }, ["mkdir", "-p", this.prebuildScriptsDir]);
                await this.agentUtilService.writeFile(ssh, paths.scriptPath, script);
              }),
            );

            return await this.agentUtilService.execVmTasks(
              sshConfig,
              db,
              tasks.map((t) => ({
                vmTaskId: t.vmTaskId,
              })),
            );
          },
        ),
    );
    await waitForPromises(
      (
        [
          [rootFsContainerId, outputRootFsId],
          [projectContainerId, outputProjectId],
        ] as const
      ).map(([containerId, outputId]) => this.brService.commitContainer(containerId, outputId)),
    );
    this.perfService.log("prebuild", "end", outputRootFsId);
    return result;
  }
}
