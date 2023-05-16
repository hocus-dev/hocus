import type { Prisma } from "@prisma/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { DefaultLogger, Runtime } from "@temporalio/worker";
import type { LogEntry } from "winston";

import type { TestActivities } from "./activities";
import { createTestActivities } from "./activities";

import type { AgentInjector } from "~/agent/agent-injector";
import { createAgentInjector } from "~/agent/agent-injector";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { printErrors } from "~/test-utils";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";

type ProvideTestActivities = (
  testFn: (args: {
    activities: TestActivities;
    db: Prisma.NonTransactionClient;
    injector: AgentInjector;
  }) => Promise<void>,
) => () => Promise<void>;

export const prepareTests = (): {
  getTestEnv: () => TestWorkflowEnvironment;
  getWorkflowBundle: () => any;
  provideTestActivities: ProvideTestActivities;
} => {
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
      provideDb(async (db) =>
        testFn({ activities: await createTestActivities(injector, db), db, injector }),
      ),
    );
  };

  let testEnv: TestWorkflowEnvironment = null as any;
  let workflowBundle: any = null;

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
