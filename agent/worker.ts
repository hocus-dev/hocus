import { NativeConnection, Worker } from "@temporalio/worker";
import { unwrap } from "~/utils.shared";
import * as activities from "~agent/activities";

const temporalAddress = unwrap(process.env.TEMPORAL_ADDRESS);

async function run() {
  const worker = await Worker.create({
    connection: await NativeConnection.connect({ address: temporalAddress }),
    workflowsPath: require.resolve("./workflows"),
    activities,
    taskQueue: "hello-world",
  });
  await worker.run();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
