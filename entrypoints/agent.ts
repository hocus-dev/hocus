import { join } from "path";

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { NativeConnection, Worker } from "@temporalio/worker";

import { setupHocusDevEnv } from "./utils/setup-hocus-dev-env";

import { createActivities } from "~/agent/activities/list";
import { createAgentInjector } from "~/agent/agent-injector";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";
import { runOnTimeout } from "~/utils.server";

async function run() {
  const injector = createAgentInjector();
  const agentConfig = injector.resolve(Token.Config).agent();
  const brService = injector.resolve(Token.BlockRegistryService);
  const blockRegistryRoot = agentConfig.blockRegistryRoot;

  await brService.initializeRegistry();
  const [overlaybdProcess, overlaybdProcessPromise] = await brService.startOverlaybdProcess({
    logFilePath: join(blockRegistryRoot, "logs", "overlaybd-process.log"),
  });

  if (agentConfig.createHocusProjects || agentConfig.createDevelopmentProjects) {
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

  await Promise.race([worker.run(), overlaybdProcessPromise])
    .finally(worker.shutdown)
    .finally(brService.hideEverything)
    .finally(async () => {
      overlaybdProcess.kill("SIGINT");
      await runOnTimeout({ waitFor: overlaybdProcessPromise, timeoutMs: 1000 }, () => {
        overlaybdProcess.kill("SIGKILL");
      });
    });
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
