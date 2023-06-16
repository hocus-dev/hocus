import type { Prisma, Workspace } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import type { Client } from "@temporalio/client";
import { v4 as uuidv4 } from "uuid";

import { runDeleteWorkspace, runStartWorkspace, runStopWorkspace } from ".";

import type { AgentInjector } from "~/agent/agent-injector";
import { BlockRegistryService } from "~/agent/block-registry/registry.service";
import { execSshCmdThroughProxy } from "~/agent/test-utils";
import { retry } from "~/agent/utils";
import { Token } from "~/token";
import { TEST_USER_PRIVATE_SSH_KEY } from "~/user/test-constants";
import type { createTestUser } from "~/user/test-utils";
import { formatBranchName, sleep, waitForPromises } from "~/utils.shared";

export const testWorkspace = async (args: {
  db: Prisma.NonTransactionClient;
  client: Client;
  taskQueue: string;
  workspace: Workspace;
  branchName: string;
  injector: AgentInjector;
  testUser: Awaited<ReturnType<typeof createTestUser>>;
  setWorkspaceInstanceStatusMocked: (mocked: boolean) => void;
  suppressLogPattern: (pattern: string) => number;
  unsuppressLogPattern: (patternId: number) => void;
}): Promise<void> => {
  const { db, client, taskQueue, workspace, branchName, injector, testUser } = args;
  const brService = injector.resolve(Token.BlockRegistryService);

  expect(workspace).toBeDefined();
  const startWorkspace = () =>
    client.workflow.execute(runStartWorkspace, {
      workflowId: uuidv4(),
      taskQueue,
      retry: { maximumAttempts: 1 },
      args: [workspace.id],
    });
  const stopWorkspace = () =>
    client.workflow.execute(runStopWorkspace, {
      workflowId: uuidv4(),
      taskQueue,
      retry: { maximumAttempts: 1 },
      args: [workspace.id],
    });
  const updateWorkspace = (update: { status: WorkspaceStatus }) =>
    db.workspace.update({
      where: {
        id: workspace.id,
      },
      data: update,
    });

  const { workspaceInstance: workspaceInstance1 } = await startWorkspace();
  const execInInstance1 = async (cmd: string) => {
    const cmdBash = `bash -c '${cmd}'`;
    return await execSshCmdThroughProxy({
      vmIp: workspaceInstance1.vmIp,
      privateKey: TEST_USER_PRIVATE_SSH_KEY,
      cmd: cmdBash,
    });
  };
  const sshOutput = await execInInstance1("cat /home/hocus/dev/project/proxy-test.txt");
  expect(sshOutput.stdout.toString()).toEqual("hello from the tests repository!\n");
  const cdRepo = "cd /home/hocus/dev/project &&";
  const [gitName, gitEmail] = await waitForPromises(
    ["user.name", "user.email"].map((item) =>
      execInInstance1(`${cdRepo} git config --global ${item}`).then((o) =>
        o.stdout.toString().trim(),
      ),
    ),
  );
  expect(gitName).toEqual(testUser.gitConfig.gitUsername);
  expect(gitEmail).toEqual(testUser.gitConfig.gitEmail);
  const gitBranchName = await execInInstance1(`${cdRepo} git branch --show-current`).then((o) =>
    o.stdout.toString().trim(),
  );
  expect(gitBranchName).toEqual(formatBranchName(branchName));

  await stopWorkspace();

  const { workspaceInstance: workspaceInstance2 } = await startWorkspace();
  const runtime2 = injector.resolve(Token.QemuService)(workspaceInstance2.runtimeInstanceId);
  await runtime2.cleanup();
  await stopWorkspace();

  const { workspaceInstance: workspaceInstance3 } = await startWorkspace();
  const { status: startWorkspaceStatus } = await startWorkspace();
  expect(startWorkspaceStatus).toBe("found");
  const runtime3 = injector.resolve(Token.QemuService)(workspaceInstance3.runtimeInstanceId);
  await runtime3.cleanup();
  await stopWorkspace();

  const { workspaceInstance: workspaceInstance4 } = await startWorkspace();
  args.setWorkspaceInstanceStatusMocked(false);
  const runtime4 = injector.resolve(Token.QemuService)(workspaceInstance4.runtimeInstanceId);
  await runtime4.cleanup();
  await sleep(1000);
  const waitForStatus = (statuses: WorkspaceStatus[]) =>
    retry(
      async () => {
        const workspace4 = await db.workspace.findUniqueOrThrow({
          where: {
            id: workspace.id,
          },
        });
        // the monitoring workflow should have stopped the workspace
        expect(statuses.includes(workspace4.status)).toBe(true);
      },
      10,
      1000,
    );
  await waitForStatus([
    WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP,
    WorkspaceStatus.WORKSPACE_STATUS_STOPPED,
  ]);
  await waitForStatus([WorkspaceStatus.WORKSPACE_STATUS_STOPPED]);
  await retry(
    async () => {
      const monitoringWorkflowInfo = await client.workflow
        .getHandle(workspaceInstance4.monitoringWorkflowId)
        .describe();
      expect(monitoringWorkflowInfo.status.name).toBe("COMPLETED");
    },
    5,
    3000,
  );

  await updateWorkspace({
    status: WorkspaceStatus.WORKSPACE_STATUS_STARTED,
  });
  const expectedErrorMessage =
    "Workspace state WORKSPACE_STATUS_STARTED is not one of WORKSPACE_STATUS_STOPPED, WORKSPACE_STATUS_STOPPED_WITH_ERROR";
  const patternId = args.suppressLogPattern(expectedErrorMessage);
  await startWorkspace()
    .then(() => {
      throw new Error("should have thrown");
    })
    .catch((err: any) => {
      expect(err?.cause?.cause?.message).toMatch(expectedErrorMessage);
    });
  args.unsuppressLogPattern(patternId);
  const workspaceWithImages = await db.workspace.findUniqueOrThrow({
    where: {
      id: workspace.id,
    },
    include: {
      projectImage: true,
      rootFsImage: true,
    },
  });
  expect(workspaceWithImages.status).toBe(WorkspaceStatus.WORKSPACE_STATUS_STOPPED_WITH_ERROR);
  expect(workspaceWithImages.latestError).not.toBeNull();
  await client.workflow.execute(runDeleteWorkspace, {
    workflowId: uuidv4(),
    taskQueue,
    retry: { maximumAttempts: 1 },
    args: [{ workspaceId: workspace.id }],
  });
  expect(
    await brService.hasContent(
      BlockRegistryService.genContainerId(workspaceWithImages.rootFsImage.tag),
    ),
  ).toBe(false);
  expect(
    await brService.hasContent(
      BlockRegistryService.genContainerId(workspaceWithImages.projectImage.tag),
    ),
  ).toBe(false);
  const workspaceAfterDelete = await db.workspace.findUnique({
    where: {
      id: workspace.id,
    },
  });
  expect(workspaceAfterDelete).toBeNull();
};
