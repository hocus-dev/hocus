/* eslint-disable no-console */
import * as activities from "~/agent/activities";

async function run() {
  await activities.fetchRepository({
    instanceId: "fetchrepo",
    kernelPath: "/hocus-resources/vmlinux-5.6-x86_64.bin",
    rootFsPath: "/hocus-resources/fetchrepo.ext4",
    outputDrive: {
      pathOnHost: "/hocus-resources/repo-typebox.ext4",
      sizeMiB: 1000,
    },
    resourcesDir: "/app/resources",
    repositoryUrl: "https://github.com/sinclairzx81/typebox",
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
