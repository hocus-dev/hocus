/* eslint-disable no-console */
import { createActivities } from "~/agent/activities";
import { createAgentInjector } from "~/agent/agent-injector";
import { DEFAULT_PREBUILD_SSH_KEY_PUBLIC } from "~/agent/constants";

async function run() {
  const injector = createAgentInjector();
  const activities = await createActivities(injector);
  await activities.startWorkspace({
    runId: "tester",
    filesystemDrivePath: "/hocus-resources/buildfs.ext4",
    projectDrivePath: "/hocus-resources/checked-out-typebox.ext4",
    authorizedKeys: DEFAULT_PREBUILD_SSH_KEY_PUBLIC,
    tasks: [],
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
