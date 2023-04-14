// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { NativeConnection, Worker } from "@temporalio/worker";

import { setupHocusDevEnv } from "./utils/setup-hocus-dev-env";

import { createActivities } from "~/agent/activities/list";
import { createAgentInjector } from "~/agent/agent-injector";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";

async function run() {
  const injector = createAgentInjector();
  const agentConfig = injector.resolve(Token.Config).agent();

  if (agentConfig.createHocusProjects || agentConfig.createDevelopementProjects) {
    // eslint-disable-next-line no-console
    console.log("Setting up projects automatically");
    // eslint-disable-next-line no-console
    void setupHocusDevEnv().catch(console.error);
  } else {
    // eslint-disable-next-line no-console
    console.log("Not setting up any projects");
  }

  const db = new PrismaClient({ datasources: { db: { url: agentConfig.databaseUrl } } });
  const activities = await createActivities(injector, db);

  const workflowBundle =
    process.env.NODE_ENV === "production"
      ? {
          codePath: require.resolve("./workflow-bundle.js"),
        }
      : await generateTemporalCodeBundle();

  const worker = await Worker.create({
    connection: await NativeConnection.connect({ address: agentConfig.temporalAddress }),
    workflowBundle,
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
