import type { Prisma } from "@prisma/client";
import type { Client } from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { DefaultLogger, Runtime, Worker } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";
import type { LogEntry } from "winston";

import type { TestActivities } from "./activities";
import { createTestActivities } from "./activities";

import type { AgentInjector } from "~/agent/agent-injector";
import { createAgentInjector } from "~/agent/agent-injector";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { printErrors } from "~/test-utils";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";

type CreateWorkerFn = (args?: {
  activityOverrides?: Partial<TestActivities>;
  taskQueue?: string;
}) => Promise<{ worker: Worker; client: Client; taskQueue: string }>;

type ProvideTestActivities = (
  testFn: (args: {
    activities: TestActivities;
    db: Prisma.NonTransactionClient;
    injector: AgentInjector;
    createWorker: CreateWorkerFn;
  }) => Promise<void>,
) => () => Promise<void>;

export const prepareTests = (): {
  getTestEnv: () => TestWorkflowEnvironment;
  getWorkflowBundle: () => any;
  provideTestActivities: ProvideTestActivities;
} => {
  let testEnv: TestWorkflowEnvironment = null as any;
  let workflowBundle: any = null;

  const provideTestActivities: ProvideTestActivities = (testFn) => {
    const injector = createAgentInjector({
      [Token.Logger]: {
        provide: {
          factory: function () {
            return new DefaultLogger("ERROR");
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
    return printErrors(
      provideDb(async (db) => {
        const activities = await createTestActivities(injector, db);
        const createWorker: CreateWorkerFn = async (args) => {
          const taskQueue = args?.taskQueue ?? `test-${uuidv4()}`;
          const { nativeConnection } = testEnv;
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
          return { worker, client: testEnv.client, taskQueue };
        };
        return testFn({
          activities,
          db,
          injector,
          createWorker,
        });
      }),
    );
  };

  beforeAll(async () => {
    // Use console.log instead of console.error to avoid red output
    // Filter INFO log messages for clearer test output
    Runtime.install({
      logger: new DefaultLogger("WARN", (entry: LogEntry) => {
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
    workflowBundle = await generateTemporalCodeBundle("~/agent/workflows/tests/workflows");
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  return {
    getTestEnv: () => testEnv,
    getWorkflowBundle: () => workflowBundle,
    provideTestActivities,
  };
};
