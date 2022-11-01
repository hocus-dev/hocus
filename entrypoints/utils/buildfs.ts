/* eslint-disable no-console */
import * as activities from "~/agent/activities";

async function run() {
  await activities.buildfs({
    instanceId: "buildfs",
    kernelPath: "/hocus-resources/vmlinux-5.6-x86_64.bin",
    rootFsPath: "/hocus-resources/buildfs.ext4",
    outputDrive: {
      pathOnHost: "/hocus-resources/buildfs-extra.ext4",
      sizeMiB: 1000,
    },
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
