import { PrebuildEventStatus, VmTaskStatus } from "@prisma/client";
import { Context } from "@temporalio/activity";
import type { Client, WorkflowExecutionStatusName, WorkflowHandle } from "@temporalio/client";
import { Worker } from "@temporalio/worker";
import { Mutex } from "async-mutex";
import { v4 as uuidv4 } from "uuid";

import type { TestActivities } from "./activities";
import { createTestActivities } from "./activities";
import { cancelLockSignal, isLockAcquiredQuery, releaseLockSignal } from "./mutex/shared";
import { runSharedWorkflowTest } from "./shared-workflow/workflow";
import { createTestRepo } from "./utils";
import {
  testLock,
  cancellationTestWorkflow,
  acquireLockAndWaitForSignal,
  scheduleNewPrebuild,
} from "./workflows";

import { NotFoundExecutionStatus, wakeSignal } from "~/agent/activities/mutex/shared";
import {
  getWaitingWorkflowId,
  requestsQuery,
  sharedWorkflowIdQuery,
} from "~/agent/activities/shared-workflow/shared";
import { withActivityHeartbeat } from "~/agent/activities/utils";
import { createAgentInjector } from "~/agent/agent-injector";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { sleep, unwrap, waitForPromises } from "~/utils.shared";

type CreateWorkerFn = (args?: {
  activityOverrides?: Partial<TestActivities>;
  taskQueue?: string;
}) => Promise<{ worker: Worker; client: Client; taskQueue: string }>;

const testEnv = new TestEnvironmentBuilder(createAgentInjector)
  .withTestLogging()
  .withTestDb()
  .withLocalTemporal("~/agent/workflows/tests/workflows")
  .withBlockRegistry()
  .withLateInits({
    activities: async ({ lateInitPromises, injector }) => {
      const db = await lateInitPromises.db;
      return createTestActivities(injector, db);
    },
  })
  .withLateInits({
    createWorker: async ({ lateInitPromises }) => {
      const taskQueue = await lateInitPromises.taskQueue;
      const workflowBundle = await lateInitPromises.workflowBundle;
      const temporalTestEnv = await lateInitPromises.temporalTestEnv;
      const activities = await lateInitPromises.activities;

      const result: CreateWorkerFn = async (args) => {
        const { nativeConnection } = temporalTestEnv;
        const worker = await Worker.create({
          connection: nativeConnection,
          taskQueue,
          activities: {
            ...activities,
            ...args?.activityOverrides,
          },
          dataConverter: {
            payloadConverterPath: require.resolve("~/temporal/data-converter"),
          },
          workflowBundle,
        });
        return { worker, client: temporalTestEnv.client, taskQueue };
      };
      return result;
    },
  });

// Temporal worker setup is long
jest.setTimeout(300 * 1000);

// The purpose of this test was to see how cancellation works in Temporal.
// What I've learned is that activity cancellation is not the same as workflow cancellation.
// The programmer must manually check for cancellation in the activity and handle it. You do
// this with Context.current().cancelled. If you don't check for cancellation, the activity
// will just continue execution.
// Also, the workflow must be configured to wait for activity cancellation to complete - otherwise
// activities will be abandoned and will continue running in the background. You have to
// use ActivityCancellationType.WAIT_CANCELLATION_COMPLETED in proxyActivities.
// Also, if you cancel an activity with maximumAttempts > 1, the activity will not be retried after
// cancellation.
// I've also learned that once you cancel a workflow, all activities are cancelled. Even if you
// handle one activity's cancellation, the other activities will still be cancelled. You have to use
// CancellationScope.nonCancellable to prevent this.
test.concurrent(
  "cancellationTest",
  testEnv.run(async ({ createWorker }) => {
    const locks = new Map(
      await Promise.all(
        ["1", "2", "3", "4"].map(async (id) => {
          const mutex = new Mutex();
          const release = await mutex.acquire();
          return [id, { mutex, release }] as const;
        }),
      ),
    );
    const cancelLock = new Mutex();
    const releaseCancelLock = await cancelLock.acquire();

    const { worker, client, taskQueue } = await createWorker({
      activityOverrides: {
        cancellationTest: withActivityHeartbeat({ intervalMs: 250 }, async (result: string) => {
          if (result === "2") {
            releaseCancelLock();
          }
          const { mutex } = unwrap(locks.get(result));
          const release = await Promise.race([mutex.acquire(), Context.current().cancelled]);
          release();
          return result;
        }),
      },
    });

    await worker.runUntil(async () => {
      const workflowId = uuidv4();
      const handle = await client.workflow.start(cancellationTestWorkflow, {
        workflowId,
        taskQueue,
        retry: { maximumAttempts: 1 },
      });
      unwrap(locks.get("1")).release();
      await cancelLock.acquire().then((release) => release());
      await handle.cancel();
      unwrap(locks.get("3")).release();
      unwrap(locks.get("4")).release();
      try {
        const result = await handle.result();
        expect(result).toEqual(["1", "cancelled", "3", "cancelled"]);
      } finally {
        for (const { release } of locks.values()) {
          release();
        }
      }
    });
  }),
);

test.concurrent(
  "withLock",
  testEnv.run(async ({ createWorker }) => {
    let counter = 0;
    const { worker, client, taskQueue } = await createWorker({
      activityOverrides: {
        mutexTest: async () => {
          return counter++;
        },
      },
    });

    await worker.runUntil(async () => {
      const results = await waitForPromises(
        [0, 1, 2].map(() =>
          client.workflow.execute(testLock, {
            workflowId: uuidv4(),
            taskQueue,
            retry: { maximumAttempts: 1 },
            args: [],
          }),
        ),
      );
      expect(results).toHaveLength(3);
      const parseResult = (workflowResult: string[], i: number): number => {
        const acquire = workflowResult[i];
        const activityResult = workflowResult[i + 1];
        const release = workflowResult[i + 2];
        expect(acquire).toMatch(/^acquire-\d+$/);
        expect(activityResult).toMatch(/^result-\d+-\d+$/);
        expect(release).toMatch(/^release-\d+$/);
        const acquireId = parseInt(acquire.split("-")[1]);
        const splitResult = activityResult.split("-");
        const activityResultId = parseInt(splitResult[1]);
        const activityResultValue = parseInt(splitResult[2]);
        const releaseId = parseInt(release.split("-")[1]);
        // Here we check that the inner lock works
        expect(acquireId).toBe(releaseId);
        expect(activityResultId).toBe(releaseId);
        return activityResultValue;
      };
      for (const result of results) {
        expect(result).toHaveLength(15);
        const activityResults = Array.from({ length: result.length / 3 }).map((_, i) =>
          parseResult(result, i * 3),
        );
        // Here we check that the outer lock works
        for (let i = 0; i < activityResults.length - 1; i++) {
          const curActivityResult = activityResults[i];
          const nextActivityResult = activityResults[i + 1];
          expect(curActivityResult + 1).toBe(nextActivityResult);
        }
      }
    });
  }),
);

const waitForStatus = async (
  handle: WorkflowHandle<any>,
  status: WorkflowExecutionStatusName,
  timeoutMs = 10000,
) => {
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for status ${status} for workflow ${handle.workflowId}`);
    }
    const currentStatus = (await handle.describe()).status.name;
    if (currentStatus === status) {
      break;
    }
    await sleep(100);
  }
};

// tests:
// - workflow holding the lock is terminated and releases the lock eventually
// - workflow holding the lock completes successfully, but does not release the lock by itself, releases the lock eventually
// - workflow next in queue for the lock is terminated and does not break the lock sync workflow
// - workflow holding the lock is cancelled and releases the lock immediately
// - getWorkflowStatus activity returns correct status for nonexistent workflow
// - mutex lock can start again after completion
test.concurrent(
  "lock cancellation",
  testEnv.run(async ({ createWorker, activities }) => {
    const { worker, client, taskQueue } = await createWorker();

    const scheduleAcquireLock = (lockId: string) =>
      client.workflow.start(acquireLockAndWaitForSignal, {
        workflowId: uuidv4(),
        taskQueue,
        args: [lockId],
      });
    const acquireLock = async (lockId: string) => {
      const handle = await scheduleAcquireLock(lockId);
      while (true) {
        if (await handle.query(isLockAcquiredQuery).catch(() => false)) {
          break;
        }
        await sleep(250);
      }
      return handle;
    };
    const wakeLockWorkflow = (lockId: string) =>
      client.workflow.getHandle(lockId).signal(wakeSignal);
    await worker.runUntil(async () => {
      // case 1
      const lockId1 = uuidv4();
      const handle1 = await acquireLock(lockId1);
      const handle2 = await scheduleAcquireLock(lockId1);
      await handle1.terminate();
      await wakeLockWorkflow(lockId1);
      await handle2.signal(releaseLockSignal);
      await handle2.result();

      // case 2
      const lockId2 = uuidv4();
      const handle3 = await acquireLock(lockId2);
      const handle4 = await scheduleAcquireLock(lockId2);
      await handle3.signal(cancelLockSignal);
      await handle3.result();
      await wakeLockWorkflow(lockId2);
      await handle4.signal(releaseLockSignal);
      await handle4.result();

      // case 3
      const lockId3 = uuidv4();
      const handle5 = await acquireLock(lockId3);
      const handle6 = await scheduleAcquireLock(lockId3);
      await handle6.terminate();
      await handle5.signal(releaseLockSignal);
      await handle5.result();
      const handle6aux = await acquireLock(lockId3);
      await handle6aux.signal(releaseLockSignal);
      await handle6aux.result();

      // case 4
      const lockId4 = uuidv4();
      const handle7 = await acquireLock(lockId4);
      const handle8 = await scheduleAcquireLock(lockId4);
      await handle7.cancel();
      await handle8.signal(releaseLockSignal);
      await handle8.result();

      // case 5
      expect(await activities.getWorkflowStatus("non-existent-workflow")).toEqual(
        NotFoundExecutionStatus,
      );

      // case 6
      await wakeLockWorkflow(lockId4);
      const lock4Handle = client.workflow.getHandle(lockId4);
      await waitForStatus(lock4Handle, "COMPLETED", 10000);
      const handle9 = await acquireLock(lockId4);
      await handle9.signal(releaseLockSignal);
      await handle9.result();
    });
  }),
);

// tests:
// 1. workflows wait on the lock and obtain the same result
// 2. cancelling one workflow does not affect the others
// 3. cancelling all workflows cancels the shared workflow
// 4. running shared workflow again after it was cancelled works
// 5. running shared workflow again after it completed successfully works
test.concurrent(
  "withSharedWorkflow",
  testEnv.run(async ({ createWorker }) => {
    const mutex = new Mutex();
    let counter = 0;
    let release = await mutex.acquire();
    const { worker, client, taskQueue } = await createWorker({
      activityOverrides: {
        sharedWorkflowTestActivity: withActivityHeartbeat({ intervalMs: 100 }, async () => {
          release = await Promise.race([mutex.acquire(), Context.current().cancelled]).catch(
            (err) => {
              mutex.cancel();
              throw err;
            },
          );
          counter += 1;
          return counter;
        }),
      },
    });
    const waitForNumRequests = async (lockId: string, num: number) => {
      const handle = client.workflow.getHandle(getWaitingWorkflowId(lockId));
      while (true) {
        try {
          const result = await handle.query(requestsQuery);
          if (result.length >= num) {
            break;
          }
          await sleep(100);
        } catch (err) {
          continue;
        }
      }
    };
    const runTestWorkflow = (lockId: string) =>
      client.workflow.start(runSharedWorkflowTest, {
        workflowId: uuidv4(),
        taskQueue,
        args: [lockId],
      });

    await worker.runUntil(async () => {
      // case 1
      const lockId1 = uuidv4();
      const handles1 = await waitForPromises(
        Array.from({ length: 3 }).map(() => runTestWorkflow(lockId1)),
      );
      await waitForNumRequests(lockId1, 3);
      release();
      const results1 = await waitForPromises(handles1.map((h) => h.result()));
      expect(results1.every((v) => v === 1)).toBe(true);

      // case 2
      const lockId2 = uuidv4();
      const handles2 = await waitForPromises(
        Array.from({ length: 4 }).map(() => runTestWorkflow(lockId2)),
      );
      await waitForNumRequests(lockId2, 4);
      await handles2[0].cancel();
      await waitForStatus(handles2[0], "CANCELLED");
      release();
      const results2 = await waitForPromises(handles2.map((h) => h.result().catch((e) => e)));
      expect(results2.slice(1).every((v) => v === 2)).toBe(true);
      expect(results2[0]?.cause?.name).toEqual("CancelledFailure");

      // case 3
      const lockId3 = uuidv4();
      const handles3 = await waitForPromises(
        Array.from({ length: 5 }).map(() => runTestWorkflow(lockId3)),
      );
      await waitForNumRequests(lockId3, 5);
      await waitForPromises(handles3.map((h) => h.cancel()));
      await waitForPromises(handles3.map((h) => waitForStatus(h, "CANCELLED")));
      const waitingWorkflow3Handle = client.workflow.getHandle(getWaitingWorkflowId(lockId3));
      await waitForStatus(waitingWorkflow3Handle, "COMPLETED");
      const sharedWorkflowId = await waitingWorkflow3Handle.query(sharedWorkflowIdQuery);
      const sharedWorkflow3Handle = client.workflow.getHandle(sharedWorkflowId);
      await waitForStatus(sharedWorkflow3Handle, "CANCELLED");

      // case 4
      const handles4 = await waitForPromises(
        Array.from({ length: 3 }).map(() => runTestWorkflow(lockId3)),
      );
      await waitForNumRequests(lockId3, 3);
      release();
      const results4 = await waitForPromises(handles4.map((h) => h.result()));
      expect(results4.every((v) => v === 3)).toBe(true);

      // case 5
      const handles5 = await waitForPromises(
        Array.from({ length: 3 }).map(() => runTestWorkflow(lockId1)),
      );
      await waitForNumRequests(lockId1, 3);
      release();
      const results5 = await waitForPromises(handles5.map((h) => h.result()));
      expect(results5.every((v) => v === 4)).toBe(true);
    });
  }),
);

test.concurrent(
  "cancel prebuild",
  testEnv.run(async ({ createWorker, injector, db, suppressLogPattern }) => {
    const { worker, client, taskQueue } = await createWorker();
    const projectService = injector.resolve(Token.ProjectService);
    const agentGitService = injector.resolve(Token.AgentGitService);
    suppressLogPattern("Not connected to server");

    await worker.runUntil(async () => {
      const repo = await createTestRepo(db, injector);
      const project = await db.$transaction((tdb) =>
        projectService.createProject(tdb, {
          gitRepositoryId: repo.id,
          rootDirectoryPath: "/",
          name: "test1",
        }),
      );
      await db.project.update({
        where: { id: project.id },
        data: {
          maxPrebuildRamMib: 1024,
          maxPrebuildVCPUCount: 1,
        },
      });
      await agentGitService.updateBranches(db, repo.id);
      const branch = unwrap(
        await db.gitBranch.findFirst({
          where: {
            gitRepositoryId: repo.id,
            name: "refs/heads/cancel-prebuild-test",
          },
        }),
      );
      const { prebuildEvent } = await client.workflow.execute(scheduleNewPrebuild, {
        args: [{ projectId: project.id, gitObjectId: branch.gitObjectId }],
        taskQueue,
        workflowId: uuidv4(),
      });
      const getUpdated = () =>
        db.prebuildEvent.findUniqueOrThrow({
          where: {
            id: prebuildEvent.id,
          },
          include: {
            tasks: {
              include: {
                vmTask: true,
              },
            },
          },
        });
      while (true) {
        const prebuild = await getUpdated();
        const task = prebuild.tasks.length > 0 ? prebuild.tasks[0].vmTask : null;
        if (task?.status === VmTaskStatus.VM_TASK_STATUS_RUNNING) {
          break;
        }
        await sleep(500);
      }
      const handle = client.workflow.getHandle(prebuildEvent.workflowId);
      await handle.cancel();
      await handle.result().catch(() => {
        // ignore
      });
      const prebuild = await getUpdated();
      expect(prebuild.status).toEqual(PrebuildEventStatus.PREBUILD_EVENT_STATUS_CANCELLED);
      expect(prebuild.tasks.length).toEqual(2);
      for (const task of prebuild.tasks) {
        expect([
          VmTaskStatus.VM_TASK_STATUS_ERROR,
          VmTaskStatus.VM_TASK_STATUS_CANCELLED,
        ]).toContain(task.vmTask.status);
      }
    });
  }),
);
