/* eslint-disable no-console */
import * as activities from "~/agent/activities";

async function run() {
  await activities.startFirecrackerInstance("tester");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
