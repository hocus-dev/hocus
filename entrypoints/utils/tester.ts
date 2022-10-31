/* eslint-disable no-console */
import * as activities from "~/agent/activities";

async function run() {
  await activities.startVM({
    instanceId: "tester",
    kernelPath: "/hocus-resources/vmlinux-5.6-x86_64.bin",
    rootFsPath: "/hocus-resources/buildfs.ext4",
    drives: [
      {
        driveId: "extra1",
        pathOnHost: "/hocus-resources/extra.ext4",
        isReadOnly: false,
        isRootDevice: false,
      },
    ],
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
