/* eslint-disable no-console */
import { createActivities } from "~/agent/activities";

async function run() {
  const activities = await createActivities();

  await activities.fetchRepository({
    instanceId: "fetchrepo",
    kernelPath: "/hocus-resources/vmlinux-5.6-x86_64.bin",
    rootFsPath: "/hocus-resources/fetchrepo.ext4",
    outputDrive: {
      pathOnHost: "/hocus-resources/repo-typebox.ext4",
      maxSizeMiB: 1000,
    },
    resourcesDir: "/app/resources",
    repositoryUrl: "https://github.com/sinclairzx81/typebox",
  });
}

run().catch((err) => {
  console.trace(err);
  process.exit(1);
});
