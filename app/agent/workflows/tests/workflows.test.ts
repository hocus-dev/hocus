import { Worker } from "@temporalio/worker";
import { Mutex } from "async-mutex";
import { v4 as uuidv4 } from "uuid";

import { prepareTests } from "./utils";
import { cancellationTestWorkflow } from "./wait-for-workflow/workflow";

import { withActivityHeartbeat } from "~/agent/activities/utils";
import { unwrap, sleep } from "~/utils.shared";

const { provideTestActivities, getWorkflowBundle, getTestEnv } = prepareTests();

// Temporal worker setup is long
jest.setTimeout(30 * 1000);

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

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("./workflows"),
      activities: {
        ...activities,
        cancellationTest: withActivityHeartbeat({ intervalMs: 250 }, async (result: string) => {
          console.log("activity start", result, new Date());
          const { mutex } = unwrap(locks.get(result));
          // const release = await Promise.race([mutex.acquire(), Context.current().cancelled]);
          const release = await mutex.acquire();
          release();
          console.log("activity result", result, new Date());
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
      await sleep(1000);
      await handle.cancel();
      console.log("cancelled");
      await sleep(1000);
      console.log((await handle.describe()).status.name);
      // unwrap(locks.get("2")).release();
      unwrap(locks.get("3")).release();
      try {
        await handle.result();
      } finally {
        console.log("got result");
        for (const { release } of locks.values()) {
          release();
        }
      }
    });
  }),
);
