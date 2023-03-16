// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import { createActivities } from "~/agent/activities/list";
import { createAgentInjector } from "~/agent/agent-injector";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";

async function run() {
  const injector = createAgentInjector();
  const agentConfig = injector.resolve(Token.Config).agent();
  const db = new PrismaClient({ datasources: { db: { url: agentConfig.databaseUrl } } });
  const activities = await createActivities(injector, db);

  const worker = await Worker.create({
    connection: await NativeConnection.connect({ address: agentConfig.temporalAddress }),
    workflowsPath: require.resolve("~/agent/workflows"),
    activities,
    taskQueue: MAIN_TEMPORAL_QUEUE,
    dataConverter: {
      payloadConverterPath: require.resolve("~/temporal/data-converter"),
    },
  });
  // eslint-disable-next-line no-console
  console.log("Starting worker...");

  await worker.run();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
