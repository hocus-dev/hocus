import type { GitRepository, Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";
import type { Client } from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { DefaultLogger, Runtime, Worker } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";
import type { LogEntry } from "winston";

import type { TestActivities } from "./activities";
import { createTestActivities } from "./activities";

import type { AgentInjector } from "~/agent/agent-injector";
import { createAgentInjector } from "~/agent/agent-injector";
import { config } from "~/config";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { printErrors } from "~/test-utils";
import { TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
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

export const createTestRepo = async (
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
