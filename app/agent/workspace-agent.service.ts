import fs from "fs/promises";
import path from "path";

import type { Workspace, WorkspaceInstance, Prisma, LocalOciImage } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import type { NodeSSH, SSHExecOptions } from "node-ssh";

import type { AgentUtilService } from "./agent-util.service";
import type { BlockRegistryService, ContainerId, ImageId } from "./block-registry/registry.service";
import { EXPOSE_METHOD } from "./block-registry/registry.service";
import { withExposedImage } from "./block-registry/utils";
import {
  WORKSPACE_CONFIG_SYMLINK_PATH,
  WORKSPACE_DEV_DIR,
  WORKSPACE_ENV_SCRIPT_PATH,
  WORKSPACE_GIT_CHECKED_OUT_MARKER_PATH,
  WORKSPACE_GIT_CONFIGURED_MARKER_PATH,
  WORKSPACE_REPOSITORY_DIR,
  WORKSPACE_SCRIPTS_DIR,
} from "./constants";
import type { SSHGatewayService } from "./network/ssh-gateway.service";
import type { WorkspaceNetworkService } from "./network/workspace-network.service";
import type { ProjectConfigService } from "./project-config/project-config.service";
import type { HocusRuntime } from "./runtime/hocus-runtime";
import { execCmd, execSshCmd, withRuntimeAndImages } from "./utils";
import { execCmdWithOpts } from "./utils";

import type { Config } from "~/config";
import { Token } from "~/token";
import { sha256 } from "~/utils.server";
import { unwrap, waitForPromises } from "~/utils.shared";

export class InvalidWorkspaceStatusError extends Error {}

export class WorkspaceAgentService {
  static inject = [
    Token.AgentUtilService,
    Token.SSHGatewayService,
    Token.ProjectConfigService,
    Token.WorkspaceNetworkService,
    Token.BlockRegistryService,
    Token.Config,
  ] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly agentUtilService: AgentUtilService,
    private readonly sshGatewayService: SSHGatewayService,
    private readonly projectConfigService: ProjectConfigService,
    private readonly networkService: WorkspaceNetworkService,
    private readonly brService: BlockRegistryService,
    config: Config,
  ) {
    this.agentConfig = config.agent();
  }

  async createWorkspaceContainers(args: {
    projectImageId: ImageId;
    rootFsImageId: ImageId;
    outputProjectImageTag: string;
    outputRootFsImageTag: string;
  }): Promise<void> {
    await waitForPromises(
      (
        [
          [args.projectImageId, args.outputProjectImageTag],
          [args.rootFsImageId, args.outputRootFsImageTag],
        ] as const
      ).map(([imageId, outputId]) => this.brService.createContainer(imageId, outputId)),
    );
  }

  async createWorkspaceInDb(
    db: Prisma.TransactionClient,
    args: {
      name: string;
      externalId: string;
      prebuildEventId: bigint;
      agentInstanceId: bigint;
      gitBranchId: bigint;
      userId: bigint;
    },
  ): Promise<
    Workspace & {
      rootFsImage: LocalOciImage;
      projectImage: LocalOciImage;
    }
  > {
    const projectImageTag = sha256(args.externalId + "workspace-project");
    const rootFsImageTag = sha256(args.externalId + "workspace-rootfs");

    const [rootFsImage, projectImage] = await waitForPromises(
      [rootFsImageTag, projectImageTag].map((tag) =>
        db.localOciImage.create({
          data: {
            tag,
            readonly: false,
            agentInstanceId: args.agentInstanceId,
          },
        }),
      ),
    );
    const workspace = await db.workspace.create({
      data: {
        name: args.name,
        externalId: args.externalId,
        gitBranchId: args.gitBranchId,
        status: WorkspaceStatus.WORKSPACE_STATUS_PENDING_CREATE,
        prebuildEventId: args.prebuildEventId,
        agentInstanceId: args.agentInstanceId,
        userId: args.userId,
        rootFsImageId: rootFsImage.id,
        projectImageId: projectImage.id,
      },
    });
    return {
      ...workspace,
      rootFsImage,
      projectImage,
    };
  }

  async writeAuthorizedKeysToFs(
    projectContainerId: ContainerId,
    authorizedKeys: string[],
  ): Promise<void> {
    const authorizedKeysContent = authorizedKeys.map((key) => key.trim()).join("\n") + "\n";
    await withExposedImage(
      this.brService,
      projectContainerId,
      EXPOSE_METHOD.HOST_MOUNT,
      async ({ mountPoint }) => {
        const sshDir = path.join(mountPoint, `home/hocus/.ssh`);
        const authorizedKeysPath = path.join(sshDir, "authorized_keys");
        await execCmdWithOpts(["mkdir", "-p", sshDir], { uid: 1000, gid: 1000 });
        await fs.writeFile(authorizedKeysPath, authorizedKeysContent, { mode: 0o600 });
        await execCmd("chown", "1000:1000", authorizedKeysPath);
      },
    );
  }

  async oncePerWorkspace(ssh: NodeSSH, markerPath: string, fn: () => Promise<void>): Promise<void> {
    const alreadyDone = await this.agentUtilService
      .readFile(ssh, markerPath)
      .then(() => true)
      .catch(() => false);
    if (alreadyDone) {
      return;
    }

    await fn();

    await execSshCmd({ ssh }, ["mkdir", "-p", path.dirname(markerPath)]);
    await this.agentUtilService.writeFile(ssh, markerPath, "");
  }

  async checkoutToBranch(
    ssh: NodeSSH,
    /** Without the `refs/heads/` prefix. */
    branch: string,
  ): Promise<void> {
    await this.oncePerWorkspace(ssh, WORKSPACE_GIT_CHECKED_OUT_MARKER_PATH, async () => {
      const opts: SSHExecOptions = {
        cwd: WORKSPACE_REPOSITORY_DIR,
        execOptions: { env: { BRANCH: branch } as any },
      };
      await execSshCmd({ ssh, opts }, [
        "bash",
        "-c",
        'git update-ref "refs/heads/$BRANCH" "$(git rev-parse HEAD)"',
      ]);
      await execSshCmd({ ssh, opts }, ["git", "checkout", branch]);
      await execSshCmd({ ssh, opts }, [
        "git",
        "branch",
        `--set-upstream-to=origin/${branch}`,
        branch,
      ]);
    });
  }

  async writeUserGitConfig(
    ssh: NodeSSH,
    gitConfig: { username: string; email: string },
  ): Promise<void> {
    await this.oncePerWorkspace(ssh, WORKSPACE_GIT_CONFIGURED_MARKER_PATH, async () => {
      const opts: SSHExecOptions = {
        cwd: WORKSPACE_REPOSITORY_DIR,
      };
      await execSshCmd({ ssh, opts }, [
        "git",
        "config",
        "--global",
        "user.name",
        gitConfig.username,
      ]);
      await execSshCmd({ ssh, opts }, ["git", "config", "--global", "user.email", gitConfig.email]);
    });
  }

  async startWorkspace(args: {
    runtime: HocusRuntime;
    fsContainerId: ContainerId;
    projectContainerId: ContainerId;
    authorizedKeys: string[];
    workspaceRoot: string;
    tasks: { command: string; commandShell: string }[];
    environmentVariables: { name: string; value: string }[];
    userGitConfig: { username: string; email: string };
    /** Without the `refs/heads/` prefix. */
    branchName: string;
    memSizeMib: number;
    vcpuCount: number;
  }): Promise<{
    runtimePid: number;
    vmIp: string;
    ipBlockId: number;
  }> {
    await this.writeAuthorizedKeysToFs(args.projectContainerId, [
      this.agentConfig.prebuildSshPublicKey,
    ]);
    return withRuntimeAndImages(
      this.brService,
      args.runtime,
      {
        ssh: {
          username: "hocus",
          privateKey: this.agentConfig.prebuildSshPrivateKey,
        },
        fs: {
          "/": args.fsContainerId,
          [WORKSPACE_DEV_DIR]: args.projectContainerId,
        },
        shouldPoweroff: false,
        memSizeMib: args.memSizeMib,
        vcpuCount: args.vcpuCount,
      },
      async ({ ssh, vmIp, runtimePid, ipBlockId }) => {
        const taskFn = async (
          task: { command: string; commandShell: string },
          taskIdx: number,
        ): Promise<void> => {
          // The idea is to have a tmux session which is attached to an inescapable dtach session
          // Tmux logs everything which is happening in the session to a file so we may replay it when attaching using dtach
          // You may attach to the task either via tmux or by dtach :)
          const taskLogPath = `${WORKSPACE_SCRIPTS_DIR}/task-${taskIdx}.log` as const;
          const dtachSocketPath = `${WORKSPACE_SCRIPTS_DIR}/task-${taskIdx}.sock` as const;
          const tmuxSessionName = `hocus-task-${taskIdx}` as const;
          const envScript = this.agentUtilService.generateEnvVarsScript(args.environmentVariables);

          const taskInput = this.agentUtilService.generateTaskInput(
            task.command,
            path.join(WORKSPACE_REPOSITORY_DIR, args.workspaceRoot),
          );
          const taskInputPath = `${WORKSPACE_SCRIPTS_DIR}/task-${taskIdx}.in` as const;
          const attachToTaskScript = this.agentUtilService.generateAttachToTaskScript(
            dtachSocketPath,
            taskLogPath,
          );
          const attachToTaskScriptPath = `${WORKSPACE_SCRIPTS_DIR}/attach-${taskIdx}.sh` as const;

          const shellName = task.commandShell;

          await execSshCmd({ ssh }, ["mkdir", "-p", WORKSPACE_SCRIPTS_DIR]);
          await execSshCmd({ ssh }, ["mkdir", "-p", path.dirname(WORKSPACE_ENV_SCRIPT_PATH)]);
          await this.agentUtilService.writeFile(ssh, taskInputPath, taskInput);
          await this.agentUtilService.writeFile(ssh, attachToTaskScriptPath, attachToTaskScript);
          await execSshCmd({ ssh }, ["chmod", "+x", attachToTaskScriptPath]);
          await this.agentUtilService.writeFile(ssh, WORKSPACE_ENV_SCRIPT_PATH, envScript);
          const cfg = await this.projectConfigService.getConfig(
            ssh,
            WORKSPACE_REPOSITORY_DIR,
            args.workspaceRoot,
          );
          if (cfg === null) {
            throw new Error("Config not found");
          }
          if (cfg instanceof Error) {
            throw cfg;
          }
          await execSshCmd({ ssh }, ["ln", "-sf", cfg[1], WORKSPACE_CONFIG_SYMLINK_PATH]);

          // In case the VM gets OOM there will be a stale socket during startup
          await execSshCmd({ ssh }, ["rm", "-fv", dtachSocketPath]);

          await execSshCmd({ ssh }, [
            "tmux",
            "new",
            "-d",
            "-s",
            tmuxSessionName,
            // tmux handles logging, also if the dtach session exits(EOF in the terminal) then the tmux session will exit
            `tmux pipe-pane -o 'cat >>${taskLogPath}'; dtach -A ${dtachSocketPath} -E -z ${shellName} && exit`,
          ]);

          // If the socket does not exist then polls every 0.1 s up to a max of 5s
          await execSshCmd({ ssh }, [
            "bash",
            "-c",
            `timeout 5 bash -c "while [ ! -S ${dtachSocketPath} ]; do sleep 0.1; done;"; cat ${taskInputPath} | dtach -p ${dtachSocketPath}`,
          ]);

          return;
        };
        const authorizedKeys = args.authorizedKeys.map((key) => key.trim());
        await this.agentUtilService.writeFile(
          ssh,
          "/home/hocus/.ssh/authorized_keys",
          authorizedKeys.join("\n") + "\n",
        );
        await this.writeUserGitConfig(ssh, args.userGitConfig);
        await this.checkoutToBranch(ssh, args.branchName);
        await Promise.all(args.tasks.map(taskFn));
        await this.networkService.changeInterfaceVisibility(ipBlockId, "public");
        await this.sshGatewayService.addPublicKeysToAuthorizedKeys(authorizedKeys);
        return {
          runtimePid,
          vmIp,
          ipBlockId,
        };
      },
    );
  }

  async lockWorkspace(db: Prisma.TransactionClient, workspaceId: bigint): Promise<void> {
    await db.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
  }

  async markWorkspaceAs(
    db: Prisma.TransactionClient,
    workspaceId: bigint,
    status:
      | typeof WorkspaceStatus.WORKSPACE_STATUS_PENDING_START
      | typeof WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP
      | typeof WorkspaceStatus.WORKSPACE_STATUS_PENDING_DELETE,
  ): Promise<void> {
    await this.lockWorkspace(db, workspaceId);
    const workspace = await db.workspace.findUniqueOrThrow({
      where: {
        id: workspaceId,
      },
    });
    const statusPredecessors: { [key in typeof status]: WorkspaceStatus[] } = {
      [WorkspaceStatus.WORKSPACE_STATUS_PENDING_START]: [
        WorkspaceStatus.WORKSPACE_STATUS_STOPPED,
        WorkspaceStatus.WORKSPACE_STATUS_STOPPED_WITH_ERROR,
      ],
      [WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP]: [WorkspaceStatus.WORKSPACE_STATUS_STARTED],
      [WorkspaceStatus.WORKSPACE_STATUS_PENDING_DELETE]: [
        WorkspaceStatus.WORKSPACE_STATUS_STOPPED,
        WorkspaceStatus.WORKSPACE_STATUS_STOPPED_WITH_ERROR,
      ],
    };
    if (!statusPredecessors[status].includes(workspace.status)) {
      throw new InvalidWorkspaceStatusError(
        `Workspace state ${workspace.status} is not one of ${statusPredecessors[status].join(
          ", ",
        )}`,
      );
    }
    await db.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        status,
      },
    });
  }

  /** The underlying VM should already be running before calling this. */
  async createWorkspaceInstanceInDb(
    db: Prisma.TransactionClient,
    args: {
      workspaceId: bigint;
      runtimeInstanceId: string;
      monitoringWorkflowId: string;
      vmIp: string;
    },
  ): Promise<WorkspaceInstance> {
    const workspace = await db.workspace.findUniqueOrThrow({
      where: {
        id: args.workspaceId,
      },
    });
    if (workspace.status !== WorkspaceStatus.WORKSPACE_STATUS_PENDING_START) {
      throw new Error("Workspace is not in pending start state");
    }
    const workspaceInstance = await db.workspaceInstance.create({
      data: {
        runtimeInstanceId: args.runtimeInstanceId,
        monitoringWorkflowId: args.monitoringWorkflowId,
        vmIp: args.vmIp,
      },
    });
    await db.workspace.update({
      where: {
        id: args.workspaceId,
      },
      data: {
        status: WorkspaceStatus.WORKSPACE_STATUS_STARTED,
        activeInstanceId: workspaceInstance.id,
        lastOpenedAt: new Date(),
      },
    });
    return workspaceInstance;
  }

  async cleanUpWorkspaceAfterErrorDb(
    db: Prisma.TransactionClient,
    workspaceId: bigint,
    latestError: string,
  ): Promise<void> {
    await this.lockWorkspace(db, workspaceId);
    const workspace = await db.workspace.findUniqueOrThrow({
      where: {
        id: workspaceId,
      },
    });
    if (workspace.activeInstanceId != null) {
      await db.workspaceInstance.delete({
        where: {
          id: workspace.activeInstanceId,
        },
      });
    }
    await db.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        status: WorkspaceStatus.WORKSPACE_STATUS_STOPPED_WITH_ERROR,
        latestError,
      },
    });
  }

  async removeWorkspaceInstanceFromDb(
    db: Prisma.TransactionClient,
    workspaceId: bigint,
  ): Promise<void> {
    const workspace = await db.workspace.findUniqueOrThrow({
      where: {
        id: workspaceId,
      },
    });
    if (workspace.status !== WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP) {
      throw new Error("Workspace is not in pending stop state");
    }
    const workspaceInstanceId = unwrap(workspace.activeInstanceId);
    await db.workspaceInstance.delete({
      where: {
        id: workspaceInstanceId,
      },
    });
    await db.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        status: WorkspaceStatus.WORKSPACE_STATUS_STOPPED,
      },
    });
  }

  async deleteWorkspaceImagesFromDisk(args: {
    rootFsContainerId: ContainerId;
    projectContainerId: ContainerId;
  }): Promise<void> {
    await waitForPromises(
      [args.rootFsContainerId, args.projectContainerId].map((contentId) =>
        this.brService.removeContent(contentId),
      ),
    );
  }

  async deleteWorkspaceFromDb(db: Prisma.TransactionClient, workspaceId: bigint): Promise<void> {
    const workspace = await db.workspace.findUniqueOrThrow({
      where: {
        id: workspaceId,
      },
    });
    if (workspace.status !== WorkspaceStatus.WORKSPACE_STATUS_PENDING_DELETE) {
      throw new Error("Workspace is not in pending delete state");
    }
    await db.workspace.delete({
      where: {
        id: workspaceId,
      },
    });
    await db.localOciImage.deleteMany({
      where: {
        id: {
          in: [workspace.rootFsImageId, workspace.projectImageId],
        },
      },
    });
  }
}
