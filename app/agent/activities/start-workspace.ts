import type { WorkspaceInstance } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import type { CreateActivity } from "./types";

import { Token } from "~/token";
import { formatBranchName } from "~/utils.shared";

export type StartWorkspaceActivity = (workspaceId: bigint) => Promise<WorkspaceInstance>;
export const startWorkspace: CreateActivity<StartWorkspaceActivity> =
  ({ injector, db }) =>
  async (workspaceId) => {
    const monitoringWorkflowId = uuidv4();
    const fcInstanceId = monitoringWorkflowId;

    const t1 = performance.now();
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);
    const logger = injector.resolve(Token.Logger);
    const t2 = performance.now();
    logger.info(`Resolving dependencies took: ${(t2 - t1).toFixed(2)} ms`);

    await db.$transaction((tdb) =>
      workspaceAgentService.markWorkspaceAs(
        tdb,
        workspaceId,
        WorkspaceStatus.WORKSPACE_STATUS_PENDING_START,
      ),
    );
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        rootFsFile: true,
        projectFile: true,
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
      fcInstanceId,
      filesystemDrivePath: workspace.rootFsFile.path,
      projectDrivePath: workspace.projectFile.path,
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

    const r = await db.$transaction((tdb) =>
      workspaceAgentService.createWorkspaceInstanceInDb(tdb, {
        workspaceId,
        firecrackerInstanceId: fcInstanceId,
        monitoringWorkflowId,
        vmIp: instanceInfo.vmIp,
      }),
    );
    const t5 = performance.now();
    logger.info(`startWorkspaceActivity took: ${(t5 - t1).toFixed(2)} ms`);

    return r;
  };
