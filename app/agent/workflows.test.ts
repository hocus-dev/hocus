/* eslint-disable no-console */
import type { PrebuildEvent } from "@prisma/client";
import { PrebuildEventStatus, VmTaskStatus } from "@prisma/client";
import { Worker } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createActivities } from "./activities/list";
import { createAgentInjector } from "./agent-injector";
import { BlockRegistryService } from "./block-registry/registry.service";
import { expectContent } from "./block-registry/test-utils";
import { HOST_PERSISTENT_DIR } from "./constants";
import { sleep } from "./utils";
import {
  runBuildfsAndPrebuilds,
  runAddProjectAndRepository,
  runCreateWorkspace,
  runArchivePrebuild,
  runDeleteRemovablePrebuilds,
  scheduleNewPrebuild,
} from "./workflows";
import { createTestRepo } from "./workflows/tests/utils";
import { testWorkspace } from "./workflows/workspace/test-utils";

import { TESTS_REPO_URL } from "~/test-utils/constants";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { createTestUser } from "~/user/test-utils";
import { unwrap, waitForPromises } from "~/utils.shared";

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

test.concurrent("HOST_PERSISTENT_DIR has no trailing slash", async () => {
  expect(HOST_PERSISTENT_DIR).not.toMatch(/\/$/);
});

test.concurrent(
  "runBuildfsAndPrebuilds",
  testEnv.run(async (args) => {
    const {
      activities,
      injector,
      db,
      workflowBundle,
      temporalTestEnv,
      taskQueue,
      suppressLogPattern,
      unsuppressLogPattern,
    } = args;
    let isGetWorkspaceInstanceStatusMocked = true;
    const { client, nativeConnection } = temporalTestEnv;
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
    const brService = injector.resolve(Token.BlockRegistryService);
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
            prebuildStatus: PrebuildEventStatus.PREBUILD_EVENT_STATUS_ERROR,
          },
        ],
      },
    ] as const;
    const testBranches = [
      "refs/heads/run-buildfs-and-prebuilds-test-1",
      "refs/heads/run-buildfs-and-prebuilds-test-2",
      "refs/heads/run-buildfs-and-prebuilds-test-4-error",
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

      await suppressLogPattern("Failed to parse project config");
      await suppressLogPattern("dockerfile parse error on line 1: unknown instruction: an");

      await expectContent(brService, {
        numTotalContent: 0,
      });
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
          expect(prebuildEvent.status).toBe(expectedPrebuildStatus);
          if (buildfsStatus != null) {
            expect(prebuildEvent.buildfsEvent?.vmTask?.status).toBe(buildfsStatus);
          } else {
            expect(prebuildEvent.buildfsEvent).toBeNull();
          }
        }
      }
      // we expect the following block registry content:
      //
      // - fetchRepository
      //   - 1 root fs image
      //   - 1 repo container
      // - checkoutAndInspect
      //   - 1 root fs image
      // - buildfs
      //   - 1 root fs image
      //   - 1 root fs container
      //   - 1 workspace image for prebuild case 1
      //   - 1 workspace image for prebuild case 2
      //   - 1 default workspace image for case 3
      // - prebuilds
      //   - case 1
      //     - 1 workspace fs image
      //     - 1 project image
      //   - case 2
      //     - 1 workspace fs image
      //     - 1 project image
      //   - case 3
      //     - nothing, because the prebuild ended with error
      //   - case 4
      //     - 1 workspace fs image
      //     - 1 project image
      //   - case 5
      //     - nothing, because the prebuild ended with error
      //   - case 6
      //     - nothing, because the prebuild ended with error
      //
      // In total, we expect 14 content items. All temporary content items should have been garbage collected.
      await expectContent(brService, {
        numTotalContent: 14,
      });

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

      console.log("running workspace tests");
      await testWorkspace({
        db,
        client,
        taskQueue,
        workspace,
        branchName: testBranches[0].name,
        injector,
        testUser,
        setWorkspaceInstanceStatusMocked: (value) => {
          isGetWorkspaceInstanceStatusMocked = value;
        },
        suppressLogPattern,
        unsuppressLogPattern,
      });

      const successfulPrebuildEvents = await db.prebuildEvent.findMany({
        where: {
          status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS,
        },
        include: {
          prebuildEventImages: {
            include: {
              projectImage: true,
              fsImage: true,
            },
          },
        },
      });
      await waitForPromises(
        successfulPrebuildEvents.map(async (e) => {
          const doPrebuildImagesExist: () => Promise<boolean[]> = () =>
            waitForPromises(
              [e.prebuildEventImages[0].projectImage, e.prebuildEventImages[0].fsImage].map((im) =>
                brService.hasContent(BlockRegistryService.genImageId(im.tag)),
              ),
            );
          expect(await doPrebuildImagesExist()).toEqual([true, true]);
          await client.workflow.execute(runArchivePrebuild, {
            workflowId: uuidv4(),
            taskQueue,
            retry: { maximumAttempts: 1 },
            args: [{ prebuildEventId: e.id, waitForDeletion: true }],
          });
          expect(await doPrebuildImagesExist()).toEqual([false, false]);
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
  testEnv.run(async ({ activities, temporalTestEnv, taskQueue, workflowBundle }) => {
    const { client, nativeConnection } = temporalTestEnv;
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
  testEnv.run(async ({ activities, temporalTestEnv, runId, workflowBundle, injector, db }) => {
    const { client, nativeConnection } = temporalTestEnv;
    const taskQueue = runId;
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
