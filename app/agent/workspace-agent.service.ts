import fs from "fs/promises";
import path from "path";

import type { Prisma } from "@prisma/client";
import type { Config } from "~/config";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import type { AgentUtilService } from "./agent-util.service";
import type { FirecrackerService } from "./firecracker.service";
import { PidValidator } from "./pid.validator";
import type { SSHGatewayService } from "./ssh-gateway.service";
import { execSshCmd } from "./utils";

export class WorkspaceAgentService {
  static inject = [
    Token.AgentUtilService,
    Token.SSHGatewayService,
    Token.FirecrackerService,
    Token.Config,
  ] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly agentUtilService: AgentUtilService,
    private readonly sshGatewayService: SSHGatewayService,
    private readonly fcServiceFactory: (id: string) => FirecrackerService,
    config: Config,
  ) {
    this.agentConfig = config.agent();
  }

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
  }

  async startWorkspace(args: {
    fcInstanceId: string;
    filesystemDrivePath: string;
    projectDrivePath: string;
    authorizedKeys: string[];
    tasks: string[];
  }): Promise<{
    firecrackerProcessPid: number;
    vmIp: string;
    ipBlockId: number;
    taskPids: number[];
  }> {
    const fcService = this.fcServiceFactory(args.fcInstanceId);
    const devDir = "/home/hocus/dev" as const;
    const repositoryDir = `${devDir}/project` as const;
    const scriptsDir = `${devDir}/.hocus/command` as const;

    return await fcService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: this.agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: this.agentConfig.defaultKernel,
        rootFsPath: args.filesystemDrivePath,
        extraDrives: [{ pathOnHost: args.projectDrivePath, guestMountPath: devDir }],
        shouldPoweroff: false,
      },
      async ({ ssh, vmIp, firecrackerPid, ipBlockId }) => {
        const taskFn = async (task: string, taskIdx: number): Promise<number> => {
          const script = this.agentUtilService.generateTaskScript(task);
          const scriptPath = `${scriptsDir}/task-${taskIdx}.sh` as const;
          const logPath = `${scriptsDir}/task-${taskIdx}.log` as const;
          await execSshCmd({ ssh }, ["mkdir", "-p", scriptsDir]);
          await this.agentUtilService.writeFile(ssh, scriptPath, script);

          const result = await execSshCmd({ ssh, opts: { cwd: repositoryDir } }, [
            "bash",
            "-o",
            "pipefail",
            "-o",
            "errexit",
            "-c",
            `bash "${scriptPath}" > "${logPath}" 2>&1 & echo "$!"`,
          ]);
          return Number(PidValidator.Parse(result.stdout));
        };
        const authorizedKeys = args.authorizedKeys.map((key) => key.trim());
        await this.agentUtilService.writeFile(
          ssh,
          "/home/hocus/.ssh/authorized_keys",
          authorizedKeys.join("\n") + "\n",
        );
        const taskPids = await Promise.all(args.tasks.map(taskFn));
        await fcService.changeVMNetworkVisibility(ipBlockId, "public");
        await this.sshGatewayService.addPublicKeysToAuthorizedKeys(authorizedKeys);
        return {
          firecrackerProcessPid: firecrackerPid,
          vmIp,
          taskPids,
          ipBlockId,
        };
      },
    );
  }

  // async createWorkspaceInstanceInDb(
  //   db: Prisma.TransactionClient,
  //   args: {
  //     workspaceId: bigint;
  //     firecrackerInstanceId: string;
  //     vmIp: string;
  //     ipBlockId: number;

  //   },
  // );
}
