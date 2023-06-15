import type { WorkspaceInstance } from "@prisma/client";
import { LogGroupType, PrebuildEventStatus, VmTaskStatus } from "@prisma/client";
import { Worker } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { runCreateWorkspace, runStartWorkspace, runStopWorkspace } from ".";

import { createActivities } from "~/agent/activities/list";
import { createAgentInjector } from "~/agent/agent-injector";
import { execSshCmdThroughProxy } from "~/agent/test-utils";
import { createTestRepo } from "~/agent/workflows/tests/utils";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { TEST_USER_PRIVATE_SSH_KEY } from "~/user/test-constants";
import { createTestUser } from "~/user/test-utils";
import { sleep, unwrap, waitForPromises } from "~/utils.shared";

jest.setTimeout(5 * 60 * 1000);

const testEnv = new TestEnvironmentBuilder(createAgentInjector)
  .withTestLogging()
  .withTestDb()
  .withBlockRegistry()
  .withTimeSkippingTemporal()
  .withLateInits({
    activities: async ({ lateInitPromises, injector }) => {
      const db = await lateInitPromises.db;
      return createActivities(injector, db);
    },
  });

test.concurrent(
  "workspace create, start, stop, delete",
  testEnv.run(
    async ({ activities, injector, db, workflowBundle, temporalTestEnv, runId, brService }) => {
      let isGetWorkspaceInstanceStatusMocked = true;
      const { client, nativeConnection } = temporalTestEnv;
      const taskQueue = runId;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue,
        activities: {
          ...activities,
          getWorkspaceInstanceStatus: async (workspaceInstanceId: bigint) => {
            if (isGetWorkspaceInstanceStatusMocked) {
              await sleep(100);
              return "on";
            } else {
              return activities.getWorkspaceInstanceStatus(workspaceInstanceId);
            }
          },
        },
        dataConverter: {
          payloadConverterPath: require.resolve("~/temporal/data-converter"),
        },
        workflowBundle,
      });
      const agentGitService = injector.resolve(Token.AgentGitService);
      const agentUtilService = injector.resolve(Token.AgentUtilService);
      const projectService = injector.resolve(Token.ProjectService);
      const repo = await createTestRepo(db, injector);
      await agentGitService.updateBranches(db, repo.id);
      const project = await db.$transaction((tdb) =>
        projectService.createProject(tdb, {
          gitRepositoryId: repo.id,
          rootDirectoryPath: "/",
          name: "Test",
        }),
      );
      await db.project.update({
        where: { id: project.id },
        data: {
          maxWorkspaceRamMib: 1024,
          maxWorkspaceVCPUCount: 1,
        },
      });
      const agentInstance = await db.$transaction((tdb) =>
        agentUtilService.getOrCreateSoloAgentInstance(tdb),
      );
      const [projectImage, rootFsImage] = await waitForPromises(
        ["project", "rootfs"].map((tag) =>
          db.localOciImage.create({
            data: {
              tag,
              readonly: false,
              agentInstanceId: agentInstance.id,
            },
          }),
        ),
      );

      const prebuildEvent = await db.prebuildEvent.create({
        data: {
          project: {
            connect: {
              id: project.id,
            },
          },
          gitObject: {
            connect: {
              hash: "524e6586f4489d19a4d6106d6b0d0be275187d7e",
            },
          },
          workspaceTasksCommand: ["echo 1"],
          workspaceTasksShell: ["bash"],
          status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS,
          prebuildEventImages: {
            create: {
              fsImageId: rootFsImage.id,
              projectImageId: projectImage.id,
              agentInstanceId: agentInstance.id,
            },
          },
          buildfsEvent: {
            create: {
              dockerfilePath: "",
              contextPath: "",
              cacheHash: "",
              project: {
                connect: {
                  id: project.id,
                },
              },
              vmTask: {
                create: {
                  command: [],
                  cwd: "",
                  status: VmTaskStatus.VM_TASK_STATUS_SUCCESS,
                  logGroup: {
                    create: {
                      type: LogGroupType.LOG_GROUP_TYPE_VM_TASK,
                    },
                  },
                },
              },
            },
          },
        },
      });
      const branch = unwrap(
        await db.gitBranch.findFirst({
          where: {
            name: "refs/heads/checkout-and-inspect-test-1",
          },
        }),
      );

      const registry = process.env.OCI_PROXY ?? "quay.io";
      await waitForPromises([
        brService.loadImageFromRemoteRepo(
          `${registry}/hocus/hocus-tests:prebuild-project-06-11-2023-22-48-38`,
          `project`,
        ),
        brService.loadImageFromRemoteRepo(
          `${registry}/hocus/hocus-tests:prebuild-rootfs-06-11-2023-22-48-38`,
          `rootfs`,
        ),
      ]);

      const testUser = await createTestUser(db);
      await worker.runUntil(async () => {
        const workspace = await client.workflow.execute(runCreateWorkspace, {
          workflowId: uuidv4(),
          taskQueue,
          retry: { maximumAttempts: 1 },
          args: [
            {
              name: "Test Workspace 😄",
              prebuildEventId: prebuildEvent.id,
              gitBranchId: branch.id,
              externalId: uuidv4(),
              userId: testUser.id,
              startWorkspace: false,
            },
          ],
        });
        expect(workspace).toBeDefined();
        const { workspaceInstance } = await client.workflow.execute(runStartWorkspace, {
          workflowId: uuidv4(),
          taskQueue,
          retry: { maximumAttempts: 1 },
          args: [workspace.id],
        });
        const execInWorkspace = async (instance: WorkspaceInstance, cmd: string) => {
          const cmdBash = `bash -c '${cmd}'`;
          return await execSshCmdThroughProxy({
            vmIp: instance.vmIp,
            privateKey: TEST_USER_PRIVATE_SSH_KEY,
            cmd: cmdBash,
          });
        };
        const { stdout } = await execInWorkspace(
          workspaceInstance,
          "cd dev/project && git branch --show-current",
        );
        expect(stdout).toContain("checkout-and-inspect-test-1");
        await client.workflow.execute(runStopWorkspace, {
          workflowId: uuidv4(),
          taskQueue,
          retry: { maximumAttempts: 1 },
          args: [workspace.id],
        });
      });
    },
  ),
);
