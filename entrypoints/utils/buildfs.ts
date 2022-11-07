/* eslint-disable no-console */
import { createActivities } from "~/agent/activities";

async function run() {
  const activities = await createActivities();

  await activities.buildfs({
    instanceId: "buildfs",
    kernelPath: "/hocus-resources/vmlinux-5.6-x86_64.bin",
    rootFsPath: "/hocus-resources/buildfs.ext4",
    outputDrive: {
      pathOnHost: "/hocus-resources/fetchrepo.ext4",
      maxSizeMiB: 10000,
    },
    resourcesDir: "/app/resources",
    pathToDockerfile: "docker/fetchrepo.Dockerfile",
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
