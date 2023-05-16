import { Context } from "@temporalio/activity";
import { Worker } from "@temporalio/worker";
import { Mutex } from "async-mutex";
import { v4 as uuidv4 } from "uuid";

import { prepareTests } from "./utils";
import { cancellationTestWorkflow } from "./wait-for-workflow/workflow";

import { withActivityHeartbeat } from "~/agent/activities/utils";
import { unwrap } from "~/utils.shared";

const { provideTestActivities, getWorkflowBundle, getTestEnv } = prepareTests();

// Temporal worker setup is long
jest.setTimeout(30 * 1000);

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
test.concurrent(
  "cancellationTest",
  provideTestActivities(async ({ activities }) => {
    const { client, nativeConnection } = getTestEnv();
    const taskQueue = `test-${uuidv4()}`;
    const locks = new Map(
      await Promise.all(
        ["1", "2", "3"].map(async (id) => {
          const mutex = new Mutex();
          const release = await mutex.acquire();
          return [id, { mutex, release }] as const;
        }),
      ),
    );
    const cancelLock = new Mutex();
    const releaseCancelLock = await cancelLock.acquire();

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("./workflows"),
      activities: {
        ...activities,
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
      dataConverter: {
        payloadConverterPath: require.resolve("~/temporal/data-converter"),
      },
      workflowBundle: getWorkflowBundle(),
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
      try {
        const result = await handle.result();
        expect(result).toEqual(["1", "cancelled", "3"]);
      } finally {
        for (const { release } of locks.values()) {
          release();
        }
      }
    });
  }),
);
