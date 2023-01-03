import type { Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import type { LogEntry } from "@temporalio/worker";
import { Worker, Runtime, DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";
import { printErrors } from "~/test-utils";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";

import { createActivities } from "./activities";
import { createAgentInjector } from "./agent-injector";
import { HOST_PERSISTENT_DIR } from "./constants";
import { PRIVATE_SSH_KEY, TESTS_REPO_URL } from "./test-constants";
import { runBuildfsAndPrebuilds } from "./workflows";

const provideActivities = (
  testFn: (args: {
    activities: Awaited<ReturnType<typeof createActivities>>;
    runId: string;
    db: Prisma.NonTransactionClient;
    injector: ReturnType<typeof createAgentInjector>;
  }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAgentInjector({
    [Token.Logger]: function () {
      return new DefaultLogger("ERROR");
    } as unknown as any,
  });
  const runId = uuidv4();
  return printErrors(
    provideDb(async (db) =>
      testFn({ activities: await createActivities(injector, db), runId, db, injector }),
    ),
  );
};

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  // Use console.log instead of console.error to avoid red output
  // Filter INFO log messages for clearer test output
  Runtime.install({
    logger: new DefaultLogger("WARN", (entry: LogEntry) =>
      // eslint-disable-next-line no-console
      console.log(`[${entry.level}]`, entry.message, entry.meta),
    ),
  });

  testEnv = await TestWorkflowEnvironment.createTimeSkipping({
    client: {
      dataConverter: {
        payloadConverterPath: require.resolve("~/temporal/data-converter"),
      },
    },
  });
});

afterAll(async () => {
  await testEnv?.teardown();
});

test.concurrent("HOST_PERSISTENT_DIR has no trailing slash", async () => {
  expect(HOST_PERSISTENT_DIR).not.toMatch(/\/$/);
});

test.concurrent(
  "runBuildfsAndPrebuilds",
  provideActivities(async ({ activities, injector, db }) => {
    const { client, nativeConnection } = testEnv;
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: "test",
      workflowsPath: require.resolve("./workflows"),
      activities,
      dataConverter: {
        payloadConverterPath: require.resolve("~/temporal/data-converter"),
      },
    });

    const gitService = injector.resolve(Token.GitService);
    const pair = await gitService.createSshKeyPair(
      db,
      PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    const repo = await gitService.addGitRepository(db, TESTS_REPO_URL, pair.id);
    const updates = await db.$transaction((tdb) => gitService.updateBranches(tdb, repo.id));

    await worker.runUntil(async () => {
      const workflowId = uuidv4();
      const result = await client.workflow.execute(runBuildfsAndPrebuilds, {
        workflowId,
        taskQueue: "test",
        retry: { maximumAttempts: 1 },
        args: [
          repo.id,
          [
            {
              gitBranchId: updates.newGitBranches[0].id,
              gitObjectId: updates.newGitBranches[0].gitObjectId,
            },
          ],
        ],
      });
      expect(result).toBeUndefined();
    });
  }),
);
