/* eslint-disable no-console */
import { createActivities } from "~/agent/activities";

async function run() {
  const activities = await createActivities();

  const projectConfig = await activities.checkoutAndInspect({
    repositoryDrivePath: "/hocus-resources/repo-typebox.ext4",
    outputDrivePath: "/hocus-resources/checked-out-typebox.ext4",
    targetBranch: "master",
  });

  console.log("Project config:");
  console.log(projectConfig, null, 2);
}

run().catch((err) => {
  console.trace(err);
  process.exit(1);
});
