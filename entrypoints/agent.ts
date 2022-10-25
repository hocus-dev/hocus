import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "~/agent/activities";
import { unwrap } from "~/utils.shared";

const temporalAddress = unwrap(process.env.TEMPORAL_ADDRESS);

async function run() {
  const worker = await Worker.create({
    connection: await NativeConnection.connect({ address: temporalAddress }),
    workflowsPath: require.resolve("~/agent/workflows"),
    activities,
    taskQueue: "hello-world",
  });
  console.log("Starting worker...");
  await worker.run();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
