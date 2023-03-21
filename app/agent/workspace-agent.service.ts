import fs from "fs/promises";
import path from "path";

import type { Workspace, WorkspaceInstance } from "@prisma/client";
import { Prisma, WorkspaceStatus } from "@prisma/client";
import type { DefaultLogger } from "@temporalio/worker";
import type { NodeSSH, SSHExecOptions } from "node-ssh";
import { v4 as uuidv4 } from "uuid";
import type { Config } from "~/config";
import { Token } from "~/token";
import { unwrap, waitForPromises } from "~/utils.shared";

import type { AgentUtilService } from "./agent-util.service";
import {
  HOST_PERSISTENT_DIR,
  WORKSPACE_CONFIG_SYMLINK_PATH,
  WORKSPACE_DEV_DIR,
  WORKSPACE_ENV_SCRIPT_PATH,
  WORKSPACE_GIT_CONFIGURED_MARKER_PATH,
  WORKSPACE_GIT_DIR,
  WORKSPACE_REPOSITORY_DIR,
  WORKSPACE_SCRIPTS_DIR,
} from "./constants";
import type { FirecrackerService } from "./firecracker.service";
import type { ProjectConfigService } from "./project-config/project-config.service";
import type { SSHGatewayService } from "./ssh-gateway.service";
import { doesFileExist, execSshCmd } from "./utils";

export class InvalidWorkspaceStatusError extends Error {}

export class WorkspaceAgentService {
  static inject = [
    Token.Logger,
    Token.AgentUtilService,
    Token.SSHGatewayService,
    Token.ProjectConfigService,
    Token.FirecrackerService,
    Token.Config,
  ] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly logger: DefaultLogger,
    private readonly agentUtilService: AgentUtilService,
    private readonly sshGatewayService: SSHGatewayService,
    private readonly projectConfigService: ProjectConfigService,
    private readonly fcServiceFactory: (id: string) => FirecrackerService,
    config: Config,
  ) {
    this.agentConfig = config.agent();
  }

  /** Creates the files and sets the workspace status to stopped. */
  async createWorkspaceFiles(db: Prisma.Client, workspaceId: bigint): Promise<void> {
    const workspace = await db.workspace.findUniqueOrThrow({
      where: {
        id: workspaceId,
      },
      include: {
        rootFsFile: true,
        projectFile: true,
        prebuildEvent: {
          include: {
            prebuildEventFiles: {
              include: {
                projectFile: true,
                fsFile: true,
              },
            },
          },
        },
      },
    });
    if (workspace.status !== WorkspaceStatus.WORKSPACE_STATUS_PENDING_CREATE) {
      throw new Error("Workspace is not in pending create state");
    }

    const prebuildEventFiles = unwrap(
      workspace.prebuildEvent.prebuildEventFiles.find(
        (f) => f.agentInstanceId === workspace.agentInstanceId,
      ),
    );

    await Promise.all(
      [workspace.projectFile, workspace.rootFsFile]
        .map((f) => path.dirname(f.path))
        .map((dir) => fs.mkdir(dir, { recursive: true })),
    );
    await fs.copyFile(prebuildEventFiles.fsFile.path, workspace.rootFsFile.path);
    await fs.copyFile(prebuildEventFiles.projectFile.path, workspace.projectFile.path);

    await this.agentUtilService.expandDriveImage(workspace.rootFsFile.path, 50000);
    await this.agentUtilService.expandDriveImage(workspace.projectFile.path, 50000);

    await db.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        status: WorkspaceStatus.WORKSPACE_STATUS_STOPPED,
      },
    });
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
  ): Promise<Workspace> {
    const externalId = uuidv4();
    const dirPath = `${HOST_PERSISTENT_DIR}/workspace/${externalId}` as const;
    const projectFilePath = `${dirPath}/project.ext4` as const;
    const rootFsFilePath = `${dirPath}/rootfs.ext4` as const;

    const [rootFsFile, projectFile] = await waitForPromises(
      [rootFsFilePath, projectFilePath].map((filePath) =>
        db.file.create({
          data: {
            path: filePath,
            agentInstanceId: args.agentInstanceId,
          },
        }),
      ),
    );
    return await db.workspace.create({
      data: {
        name: args.name,
        externalId: args.externalId,
        gitBranchId: args.gitBranchId,
        status: WorkspaceStatus.WORKSPACE_STATUS_PENDING_CREATE,
        prebuildEventId: args.prebuildEventId,
        agentInstanceId: args.agentInstanceId,
        userId: args.userId,
        rootFsFileId: rootFsFile.id,
        projectFileId: projectFile.id,
      },
    });
  }

  async writeAuthorizedKeysToFs(
    filesystemDrivePath: string,
    authorizedKeys: string[],
  ): Promise<void> {
    const instanceId = uuidv4();
    const fcService = this.fcServiceFactory(instanceId);
    const workdir = "/workspace" as const;
    const sshDir = `${workdir}/home/hocus/.ssh` as const;
    const authorizedKeysPath = `${sshDir}/authorized_keys` as const;
    return await fcService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: this.agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: this.agentConfig.defaultKernel,
        rootFsPath: this.agentConfig.checkoutAndInspectRootFs,
        copyRootFs: true,
        extraDrives: [{ pathOnHost: filesystemDrivePath, guestMountPath: workdir }],
      },
      async ({ ssh }) => {
        await execSshCmd({ ssh }, ["mkdir", "-p", sshDir]);
        const authorizedKeysContent = authorizedKeys.map((key) => key.trim()).join("\n") + "\n";
        await this.agentUtilService.writeFile(ssh, authorizedKeysPath, authorizedKeysContent);
      },
    );
  }

  async writeUserGitConfig(
    ssh: NodeSSH,
    gitConfig: { username: string; email: string },
  ): Promise<void> {
    const gitAlreadyConfigured = await this.agentUtilService
      .readFile(ssh, WORKSPACE_GIT_CONFIGURED_MARKER_PATH)
      .then(() => true)
      .catch(() => false);
    if (gitAlreadyConfigured) {
      return;
    }
    const homeDir = "/home/hocus";
    const opts: SSHExecOptions = {
      execOptions: { env: { HOME: homeDir } as any },
      cwd: homeDir,
    };
    await execSshCmd({ ssh, opts }, ["mkdir", "-p", WORKSPACE_GIT_DIR]);
    await execSshCmd({ ssh, opts }, ["touch", `${homeDir}/.gitconfig`]);
    await execSshCmd({ ssh, opts }, ["git", "config", "--global", "user.name", gitConfig.username]);
    await execSshCmd({ ssh, opts }, ["git", "config", "--global", "user.email", gitConfig.email]);
    await execSshCmd({ ssh }, ["mkdir", "-p", path.dirname(WORKSPACE_GIT_CONFIGURED_MARKER_PATH)]);
    await this.agentUtilService.writeFile(ssh, WORKSPACE_GIT_CONFIGURED_MARKER_PATH, "1");
  }

  async startWorkspace(args: {
    fcInstanceId: string;
    filesystemDrivePath: string;
    projectDrivePath: string;
    authorizedKeys: string[];
    workspaceRoot: string;
    tasks: { command: string; commandShell: string }[];
    environmentVariables: { name: string; value: string }[];
    userGitConfig: { username: string; email: string };
  }): Promise<{
    firecrackerProcessPid: number;
    vmIp: string;
    ipBlockId: number;
  }> {
    const fcService = this.fcServiceFactory(args.fcInstanceId);

    await this.writeAuthorizedKeysToFs(args.filesystemDrivePath, [
      this.agentConfig.prebuildSshPublicKey,
    ]);

    return await fcService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: this.agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: this.agentConfig.defaultKernel,
        rootFsPath: args.filesystemDrivePath,
        extraDrives: [{ pathOnHost: args.projectDrivePath, guestMountPath: WORKSPACE_DEV_DIR }],
        shouldPoweroff: false,
      },
      async ({ ssh, vmIp, firecrackerPid, ipBlockId }) => {
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

          await this.writeUserGitConfig(ssh, args.userGitConfig);
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
          await execSshCmd({ ssh }, ["ln", "-sf", cfg[1], WORKSPACE_CONFIG_SYMLINK_PATH]);

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
        await Promise.all(args.tasks.map(taskFn));
        await fcService.changeVMNetworkVisibility(ipBlockId, "public");
        await this.sshGatewayService.addPublicKeysToAuthorizedKeys(authorizedKeys);
        return {
          firecrackerProcessPid: firecrackerPid,
          vmIp,
          ipBlockId,
        };
      },
    );
  }

  async markWorkspaceAs(
    db: Prisma.TransactionClient,
    workspaceId: bigint,
    status:
      | typeof WorkspaceStatus.WORKSPACE_STATUS_PENDING_START
      | typeof WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP
      | typeof WorkspaceStatus.WORKSPACE_STATUS_PENDING_DELETE,
  ): Promise<void> {
    await db.$executeRawUnsafe(
      `LOCK TABLE "${Prisma.ModelName.Workspace}" IN SHARE UPDATE EXCLUSIVE MODE`,
    );
    const workspace = await db.workspace.findUniqueOrThrow({
      where: {
        id: workspaceId,
      },
    });
    const statusPredecessor: { [key in typeof status]: WorkspaceStatus } = {
      [WorkspaceStatus.WORKSPACE_STATUS_PENDING_START]: WorkspaceStatus.WORKSPACE_STATUS_STOPPED,
      [WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP]: WorkspaceStatus.WORKSPACE_STATUS_STARTED,
      [WorkspaceStatus.WORKSPACE_STATUS_PENDING_DELETE]: WorkspaceStatus.WORKSPACE_STATUS_STOPPED,
    };
    if (workspace.status !== statusPredecessor[status]) {
      throw new InvalidWorkspaceStatusError(
        `Workspace is not in ${statusPredecessor[status]} state`,
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
      firecrackerInstanceId: string;
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
        firecrackerInstanceId: args.firecrackerInstanceId,
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

  async deleteWorkspaceFilesFromDisk(args: {
    rootFsFilePath: string;
    projectFilePath: string;
  }): Promise<void> {
    for (const filePath of [args.rootFsFilePath, args.projectFilePath]) {
      const fileExists = await doesFileExist(filePath);
      if (fileExists) {
        await fs.unlink(filePath);
      } else {
        this.logger.warn(`File at ${filePath} does not exist`);
      }
    }
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
    await db.file.deleteMany({
      where: {
        id: {
          in: [workspace.rootFsFileId, workspace.projectFileId],
        },
      },
    });
  }
}
