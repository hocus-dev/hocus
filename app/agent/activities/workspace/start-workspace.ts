import type { WorkspaceInstance } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";

import type { CreateActivity } from "../types";

import { BlockRegistryService } from "~/agent/block-registry/registry.service";
import { Token } from "~/token";
import { formatBranchName } from "~/utils.shared";

export type StartWorkspaceActivity = (args: {
  workspaceId: bigint;
  vmInstanceId: string;
}) => Promise<{ workspaceInstance: WorkspaceInstance; status: "found" | "started" }>;
export const startWorkspace: CreateActivity<StartWorkspaceActivity> =
  ({ injector, db }) =>
  async (args) => {
    const monitoringWorkflowId = args.vmInstanceId;

    const t1 = performance.now();
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);
    const runtime = injector.resolve(Token.QemuService)(args.vmInstanceId);
    const logger = injector.resolve(Token.Logger);
    const t2 = performance.now();
    logger.info(`Resolving dependencies took: ${(t2 - t1).toFixed(2)} ms`);

    const existingInstance = await db.$transaction(async (tdb) => {
      await workspaceAgentService.lockWorkspace(tdb, args.workspaceId);
      const existingWorkspace = await tdb.workspace.findUniqueOrThrow({
        where: {
          id: args.workspaceId,
        },
        include: {
          activeInstance: true,
        },
      });
      if (existingWorkspace.activeInstance != null) {
        return existingWorkspace.activeInstance;
      }
      await workspaceAgentService.markWorkspaceAs(
        tdb,
        args.workspaceId,
        WorkspaceStatus.WORKSPACE_STATUS_PENDING_START,
      );
    });
    if (existingInstance != null) {
      return { workspaceInstance: existingInstance, status: "found" };
    }
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { id: args.workspaceId },
      include: {
        rootFsImage: true,
        projectImage: true,
        prebuildEvent: {
          include: {
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
        },
        gitBranch: true,
        user: {
          include: {
            sshPublicKeys: true,
            gitConfig: true,
          },
        },
      },
    });
    const userEnvVarSet = await db.userProjectEnvironmentVariableSet.findUnique({
      where: {
        // eslint-disable-next-line camelcase
        userId_projectId: {
          userId: workspace.userId,
          projectId: workspace.prebuildEvent.projectId,
        },
      },
      include: {
        environmentSet: {
          include: {
            environmentVariables: true,
          },
        },
      },
    });
    const projectEnvVariables =
      workspace.prebuildEvent.project.environmentVariableSet.environmentVariables.map(
        (v) => [v.name, v.value] as const,
      );
    const userVariables =
      userEnvVarSet != null
        ? userEnvVarSet.environmentSet.environmentVariables.map((v) => [v.name, v.value] as const)
        : [];
    const environmentVariables = Array.from(
      new Map([...projectEnvVariables, ...userVariables]).entries(),
    ).map(([name, value]) => ({ name, value }));

    const t3 = performance.now();
    const instanceInfo = await workspaceAgentService.startWorkspace({
      runtime,
      fsContainerId: BlockRegistryService.genContainerId(workspace.rootFsImage.tag),
      projectContainerId: BlockRegistryService.genContainerId(workspace.projectImage.tag),
      authorizedKeys: workspace.user.sshPublicKeys.map((k) => k.publicKey),
      workspaceRoot: workspace.prebuildEvent.project.rootDirectoryPath,
      tasks: workspace.prebuildEvent.workspaceTasksCommand.map((command, idx) => ({
        command,
        commandShell: workspace.prebuildEvent.workspaceTasksShell[idx],
      })),
      environmentVariables,
      userGitConfig: {
        email: workspace.user.gitConfig.gitEmail,
        username: workspace.user.gitConfig.gitUsername,
      },
      branchName: formatBranchName(workspace.gitBranch.name),
      memSizeMib: workspace.prebuildEvent.project.maxWorkspaceRamMib,
      vcpuCount: workspace.prebuildEvent.project.maxWorkspaceVCPUCount,
    });
    const t4 = performance.now();
    logger.info(`Starting workspace took: ${(t4 - t3).toFixed(2)} ms`);

    const workspaceInstance = await db.$transaction((tdb) =>
      workspaceAgentService.createWorkspaceInstanceInDb(tdb, {
        workspaceId: args.workspaceId,
        runtimeInstanceId: args.vmInstanceId,
        monitoringWorkflowId,
        vmIp: instanceInfo.vmIp,
      }),
    );
    const t5 = performance.now();
    logger.info(`startWorkspaceActivity took: ${(t5 - t1).toFixed(2)} ms`);

    return { workspaceInstance, status: "started" };
  };
