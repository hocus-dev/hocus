/* eslint-disable no-console */
import type { GitRepository, PrebuildEvent, Prisma } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import { PrebuildEventStatus, VmTaskStatus } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import type { LogEntry } from "@temporalio/worker";
import { Worker, Runtime, DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import type { Activities } from "./activities/list";
import { createActivities } from "./activities/list";
import type { AgentInjector } from "./agent-injector";
import { createAgentInjector } from "./agent-injector";
import { HOST_PERSISTENT_DIR } from "./constants";
import { execSshCmdThroughProxy } from "./test-utils";
import { doesFileExist, retry, sleep } from "./utils";
import {
  runBuildfsAndPrebuilds,
  runAddProjectAndRepository,
  runCreateWorkspace,
  runStartWorkspace,
  runStopWorkspace,
  runDeleteWorkspace,
  runArchivePrebuild,
  runDeleteRemovablePrebuilds,
  scheduleNewPrebuild,
} from "./workflows";

import { config } from "~/config";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { printErrors } from "~/test-utils";
import { TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";
import { TEST_USER_PRIVATE_SSH_KEY } from "~/user/test-constants";
import { createTestUser } from "~/user/test-utils";
import { unwrap, waitForPromises, formatBranchName, numericSort } from "~/utils.shared";

const provideActivities = (
  testFn: (args: {
    activities: Activities;
    runId: string;
    db: Prisma.NonTransactionClient;
    injector: AgentInjector;
  }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAgentInjector({
    [Token.Logger]: {
      provide: {
        factory: function () {
          return new DefaultLogger("ERROR");
        },
      },
    },
    [Token.Config]: {
      provide: {
        value: {
          ...config,
          agent: () => ({
            ...config.agent(),
            /**
             * It's a regular buildfs root fs but with docker cache.
             * I generated it manually, by executing a buildfs workflow
             * with the regular buildfs root fs and then copying the
             * resulting drive to the test-buildfs.ext4 file.
             * I also shrank it with `resize2fs -M`.
             * The tests will also work with a regular buildfs root fs,
             * but they will be slower.
             */
            buildfsRootFs: "/srv/jailer/resources/test-buildfs.ext4",
          }),
          shared: () => ({
            ...config.shared(),
            maxRepositoryDriveSizeMib: 100,
          }),
        },
      },
    },
    [Token.TemporalClient]: {
      provide: {
        factory: () => (fn) => {
          const { client } = testEnv;
          return fn(client);
        },
      },
    },
  });
  const runId = uuidv4();
  return printErrors(
    provideDb(async (db) =>
      testFn({ activities: await createActivities(injector, db), runId, db, injector }),
    ),
  );
};

let testEnv: TestWorkflowEnvironment;
let workflowBundle: any;

const expectedErrorMessage =
  "Workspace state WORKSPACE_STATUS_STARTED is not one of WORKSPACE_STATUS_STOPPED, WORKSPACE_STATUS_STOPPED_WITH_ERROR";

beforeAll(async () => {
  // Use console.log instead of console.error to avoid red output
  // Filter INFO log messages for clearer test output
  Runtime.install({
    logger: new DefaultLogger("WARN", (entry: LogEntry) => {
      const error = entry.meta?.error;
      const msg = expectedErrorMessage;
      if (error?.stack?.includes(msg) || error?.cause?.stack?.includes(msg)) {
        // there is a test case where we expect this error,
        // so in order not to pollute the test output with it,
        // we suppress it
        return;
      }

      // eslint-disable-next-line no-console
      console.log(`[${entry.level}]`, entry.message, entry.meta);
    }),
  });

  testEnv = await TestWorkflowEnvironment.createLocal({
    client: {
      dataConverter: {
        payloadConverterPath: require.resolve("~/temporal/data-converter"),
      },
    },
  });
  workflowBundle = await generateTemporalCodeBundle();
});

afterAll(async () => {
  await testEnv?.teardown();
});

test.concurrent("HOST_PERSISTENT_DIR has no trailing slash", async () => {
  expect(HOST_PERSISTENT_DIR).not.toMatch(/\/$/);
});

const createTestRepo = async (
  db: Prisma.NonTransactionClient,
  injector: AgentInjector,
): Promise<GitRepository> => {
  const gitService = injector.resolve(Token.GitService);
  const sshKeyService = injector.resolve(Token.SshKeyService);

  const pair = await sshKeyService.createSshKeyPair(
    db,
    TESTS_PRIVATE_SSH_KEY,
    SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
  );
  const repo = await db.$transaction((tdb) =>
    gitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id),
  );
  return repo;
};

test.concurrent(
  "runBuildfsAndPrebuilds",
  provideActivities(async ({ activities, injector, db }) => {
    let isGetWorkspaceInstanceStatusMocked = true;
    const { client, nativeConnection } = testEnv;
    const taskQueue = `test-${uuidv4()}`;
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("./workflows"),
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
    const projectService = injector.resolve(Token.ProjectService);
    const repo = await createTestRepo(db, injector);
    const updates = await agentGitService.updateBranches(db, repo.id);
    console.log("branches updated");
    const projects = await db.$transaction((tdb) =>
      waitForPromises(
        [
          { name: "test1", path: "/" },
          { name: "test2", path: "inner-project" },
        ].map(({ name, path }) =>
          projectService.createProject(tdb, {
            gitRepositoryId: repo.id,
            rootDirectoryPath: path,
            name: name,
          }),
        ),
      ),
    );
    for (const project of projects) {
      await db.project.update({
        where: { id: project.id },
        data: {
          maxPrebuildRamMib: 1024,
          maxPrebuildVCPUCount: 1,
          maxWorkspaceRamMib: 1024,
          maxWorkspaceVCPUCount: 1,
          maxPrebuildRootDriveSizeMib: 1024,
        },
      });
    }
    const testBranchExpectedResults = [
      {
        testCases: [
          {
            project: projects[0],
            buildfsStatus: VmTaskStatus.VM_TASK_STATUS_SUCCESS,
            prebuildStatus: PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS,
          },
          {
            project: projects[1],
            buildfsStatus: VmTaskStatus.VM_TASK_STATUS_SUCCESS,
            prebuildStatus: PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS,
          },
        ],
      },
      {
        testCases: [
          {
            project: projects[0],
            buildfsStatus: VmTaskStatus.VM_TASK_STATUS_SUCCESS,
            prebuildStatus: PrebuildEventStatus.PREBUILD_EVENT_STATUS_ERROR,
          },
          {
            project: projects[1],
            buildfsStatus: null,
            prebuildStatus: PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS,
          },
        ],
      },
      {
        testCases: [
          {
            project: projects[0],
            buildfsStatus: VmTaskStatus.VM_TASK_STATUS_ERROR,
            prebuildStatus: PrebuildEventStatus.PREBUILD_EVENT_STATUS_ERROR,
          },
          {
            project: projects[1],
            buildfsStatus: null,
            prebuildStatus: PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS,
          },
        ],
      },
    ] as const;
    const testBranches = [
      "refs/heads/run-buildfs-and-prebuilds-test-1",
      "refs/heads/run-buildfs-and-prebuilds-test-2",
      "refs/heads/run-buildfs-and-prebuilds-test-3-error",
    ].map((name) => unwrap(updates.newGitBranches.find((b) => b.name === name)));
    await worker.runUntil(async () => {
      const gitObjectIds = Array.from(new Set(testBranches.map((b) => b.gitObjectId)));
      const prebuildEvents: PrebuildEvent[] = [];
      for (const p of projects) {
        const { created } = await activities.getOrCreatePrebuildEvents({
          projectId: p.id,
          gitObjectIds,
        });
        prebuildEvents.push(...created);
      }
      console.log("prebuild events created");

      await client.workflow.execute(runBuildfsAndPrebuilds, {
        workflowId: uuidv4(),
        taskQueue,
        retry: { maximumAttempts: 1 },
        args: [prebuildEvents.map((e) => e.id)],
      });

      console.log("runBuildfsAndPrebuilds ended");

      for (const i of testBranches.keys()) {
        const branch = testBranches[i];
        for (const {
          project,
          buildfsStatus,
          prebuildStatus: expectedPrebuildStatus,
        } of testBranchExpectedResults[i].testCases) {
          const prebuildEvents = await db.prebuildEvent.findMany({
            where: {
              gitObjectId: branch.gitObjectId,
              projectId: project.id,
            },
            include: {
              buildfsEvent: {
                include: {
                  vmTask: true,
                },
              },
            },
          });
          expect(prebuildEvents.length).toBe(1);
          const prebuildEvent = prebuildEvents[0];
          if (prebuildEvent.status !== expectedPrebuildStatus) {
            const prebuildEventWithTasks = await db.prebuildEvent.findUniqueOrThrow({
              where: {
                id: prebuildEvent.id,
              },
              include: {
                tasks: {
                  include: {
                    vmTask: {
                      include: {
                        logGroup: {
                          include: {
                            logs: {
                              orderBy: {
                                idx: "asc",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            });
            const vmTasks = prebuildEventWithTasks.tasks
              .sort((a, b) => numericSort(a.idx, b.idx))
              .map((t) => t.vmTask);
            if (buildfsStatus != null) {
              const buildfsEvent = await db.buildfsEvent.findUniqueOrThrow({
                where: {
                  id: unwrap(prebuildEvent.buildfsEventId),
                },
                include: {
                  vmTask: {
                    include: {
                      logGroup: {
                        include: {
                          logs: {
                            orderBy: {
                              idx: "asc",
                            },
                          },
                        },
                      },
                    },
                  },
                },
              });
              vmTasks.unshift(buildfsEvent.vmTask);
            }
            console.error(`Repository: ${repo.url}, root directory: ${project.rootDirectoryPath}`);
            console.error(
              `Expected prebuild event status ${expectedPrebuildStatus}, got ${prebuildEvent.status}`,
            );
            console.error(`Tasks:`);
            for (const vmTask of vmTasks) {
              console.error(`### ${vmTask.command} ###`);
              console.error(`Status: ${vmTask.status}`);
              if (
                vmTask.status === VmTaskStatus.VM_TASK_STATUS_ERROR ||
                vmTask.status === VmTaskStatus.VM_TASK_STATUS_CANCELLED
              ) {
                console.error(`Logs:`);
                console.error(vmTask.logGroup.logs.map((l) => l.content).join());
              }
            }
          }
          expect(prebuildEvent.status).toBe(expectedPrebuildStatus);
          if (buildfsStatus != null) {
            expect(prebuildEvent.buildfsEvent?.vmTask?.status).toBe(buildfsStatus);
          } else {
            expect(prebuildEvent.buildfsEvent).toBeNull();
          }
        }
      }

      const project = await db.project.findUniqueOrThrow({
        where: {
          id: projects[0].id,
        },
        include: {
          prebuildEvents: {
            include: {
              gitObject: {
                include: {
                  gitObjectToBranch: {
                    include: {
                      gitBranch: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      const prebuildEvent = unwrap(
        project.prebuildEvents.find(
          (e) =>
            e.gitObject.gitObjectToBranch.find((l) => l.gitBranchId === testBranches[0].id) != null,
        ),
      );
      const testUser = await createTestUser(db);
      console.log("running create workspace");
      const workspace = await client.workflow.execute(runCreateWorkspace, {
        workflowId: uuidv4(),
        taskQueue,
        retry: { maximumAttempts: 1 },
        args: [
          {
            name: "Test Workspace 😄",
            prebuildEventId: prebuildEvent.id,
            gitBranchId: testBranches[0].id,
            externalId: uuidv4(),
            userId: testUser.id,
            startWorkspace: false,
          },
        ],
      });
      const updateWorkspace = (update: { status: WorkspaceStatus }) =>
        db.workspace.update({
          where: {
            id: workspace.id,
          },
          data: update,
        });
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

      const { workspaceInstance: workspaceInstance1 } = await startWorkspace();
      const execInInstance1 = async (cmd: string) => {
        const cmdBash = `bash -c '${cmd}'`;
        return await execSshCmdThroughProxy({
          vmIp: workspaceInstance1.vmIp,
          privateKey: TEST_USER_PRIVATE_SSH_KEY,
          cmd: cmdBash,
        });
      };
      console.log("running workspace tests");
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
      expect(gitBranchName).toEqual(formatBranchName(testBranches[0].name));

      await stopWorkspace();

      const { workspaceInstance: workspaceInstance2 } = await startWorkspace();
      const firecrackerService2 = injector.resolve(Token.FirecrackerService)(
        workspaceInstance2.firecrackerInstanceId,
      );
      await firecrackerService2.shutdownVM();
      await stopWorkspace();

      const { workspaceInstance: workspaceInstance3 } = await startWorkspace();
      const { status: startWorkspaceStatus } = await startWorkspace();
      expect(startWorkspaceStatus).toBe("found");
      const firecrackerService3 = injector.resolve(Token.FirecrackerService)(
        workspaceInstance3.firecrackerInstanceId,
      );
      await firecrackerService3.shutdownVM();
      await firecrackerService3.deleteVMDir();
      await stopWorkspace();

      const { workspaceInstance: workspaceInstance4 } = await startWorkspace();
      isGetWorkspaceInstanceStatusMocked = false;
      const firecrackerService4 = injector.resolve(Token.FirecrackerService)(
        workspaceInstance4.firecrackerInstanceId,
      );
      await firecrackerService4.shutdownVM();
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
      await startWorkspace()
        .then(() => {
          throw new Error("should have thrown");
        })
        .catch((err: any) => {
          expect(err?.cause?.cause?.message).toMatch(expectedErrorMessage);
        });
      const workspaceWithFiles = await db.workspace.findUniqueOrThrow({
        where: {
          id: workspace.id,
        },
        include: {
          projectFile: true,
          rootFsFile: true,
        },
      });
      expect(workspaceWithFiles.status).toBe(WorkspaceStatus.WORKSPACE_STATUS_STOPPED_WITH_ERROR);
      expect(workspaceWithFiles.latestError).not.toBeNull();
      await client.workflow.execute(runDeleteWorkspace, {
        workflowId: uuidv4(),
        taskQueue,
        retry: { maximumAttempts: 1 },
        args: [{ workspaceId: workspace.id }],
      });
      expect(await doesFileExist(workspaceWithFiles.projectFile.path)).toBe(false);
      expect(await doesFileExist(workspaceWithFiles.rootFsFile.path)).toBe(false);
      const workspaceAfterDelete = await db.workspace.findUnique({
        where: {
          id: workspace.id,
        },
      });
      expect(workspaceAfterDelete).toBeNull();

      const successfulPrebuildEvents = await db.prebuildEvent.findMany({
        where: {
          status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS,
        },
        include: {
          prebuildEventFiles: {
            include: {
              projectFile: true,
              fsFile: true,
            },
          },
        },
      });
      await waitForPromises(
        successfulPrebuildEvents.map(async (e) => {
          const doPrebuildFilesExist: () => Promise<boolean[]> = () =>
            waitForPromises(
              [e.prebuildEventFiles[0].projectFile, e.prebuildEventFiles[0].fsFile].map((f) =>
                doesFileExist(f.path),
              ),
            );
          expect(await doPrebuildFilesExist()).toEqual([true, true]);
          await client.workflow.execute(runArchivePrebuild, {
            workflowId: uuidv4(),
            taskQueue,
            retry: { maximumAttempts: 1 },
            args: [{ prebuildEventId: e.id }],
          });
          expect(await doPrebuildFilesExist()).toEqual([false, false]);
          const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
            where: {
              id: e.id,
            },
          });
          expect(prebuildEvent.status).toBe(PrebuildEventStatus.PREBUILD_EVENT_STATUS_ARCHIVED);
        }),
      );
      await db.prebuildEvent.updateMany({
        where: {
          id: {
            in: successfulPrebuildEvents.map((e) => e.id),
          },
        },
        data: {
          createdAt: new Date(0),
        },
      });
      await waitForPromises(
        projects.map((p) =>
          client.workflow.execute(runDeleteRemovablePrebuilds, {
            workflowId: uuidv4(),
            taskQueue,
            retry: { maximumAttempts: 1 },
            args: [p.id],
          }),
        ),
      );
      const successfulPrebuildEventsAfterDelete = await db.prebuildEvent.findMany({
        where: {
          id: {
            in: successfulPrebuildEvents.map((e) => e.id),
          },
        },
      });
      expect(successfulPrebuildEventsAfterDelete).toEqual([]);
    });
  }),
);

test.concurrent(
  "runAddProjectAndRepository",
  provideActivities(async ({ activities }) => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = `test-${uuidv4()}`;
    const updateGitBranchesAndObjects: typeof activities.updateGitBranchesAndObjects = async () => {
      return {
        newGitBranches: [],
        updatedGitBranches: [],
      };
    };
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("./workflows"),
      activities: {
        ...activities,
        updateGitBranchesAndObjects,
      },
      dataConverter: {
        payloadConverterPath: require.resolve("~/temporal/data-converter"),
      },
      workflowBundle,
    });

    await worker.runUntil(async () => {
      const runWorkflow = () =>
        client.workflow.execute(runAddProjectAndRepository, {
          workflowId: uuidv4(),
          taskQueue,
          retry: { maximumAttempts: 1 },
          args: [
            {
              gitRepositoryUrl: TESTS_REPO_URL,
              projectName: "Test",
              projectWorkspaceRoot: "/",
            },
          ],
        });
      const { project, gitRepository } = await runWorkflow();
      expect(project.name).toBe("Test");
      expect(project.rootDirectoryPath).toBe("/");
      expect(gitRepository.url).toBe(TESTS_REPO_URL);

      const { project: project2, gitRepository: gitRepository2 } = await runWorkflow();
      expect(project2.id).not.toBe(project.id);
      expect(gitRepository2.id).toBe(gitRepository.id);
    });
  }),
);

test.concurrent(
  "scheduleNewPrebuild",
  provideActivities(async ({ activities, db, injector }) => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = `test-${uuidv4()}`;
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("./workflows"),
      activities,
      dataConverter: {
        payloadConverterPath: require.resolve("~/temporal/data-converter"),
      },
      workflowBundle,
    });
    const projectService = injector.resolve(Token.ProjectService);
    const repo = await createTestRepo(db, injector);
    const project = await db.$transaction((tdb) =>
      projectService.createProject(tdb, {
        gitRepositoryId: repo.id,
        rootDirectoryPath: "/",
        name: "test",
      }),
    );
    const gitObject = await db.gitObject.create({
      data: {
        hash: "test",
      },
    });

    await worker.runUntil(async () => {
      const { prebuildEvent, prebuildWorkflowId } = await client.workflow.execute(
        scheduleNewPrebuild,
        {
          workflowId: uuidv4(),
          taskQueue,
          retry: { maximumAttempts: 1 },
          args: [{ projectId: project.id, gitObjectId: gitObject.id }],
        },
      );
      expect(prebuildEvent.id).toBeTruthy();
      const handle = client.workflow.getHandle(prebuildWorkflowId);
      await handle.cancel();
      await expect(handle.result()).rejects.toThrow();
    });
  }),
);
