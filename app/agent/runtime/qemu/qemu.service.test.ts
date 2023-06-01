import path from "path";

import testImages from "../../block-registry/test-data/test_images.json";
import { doesFileExist, execSshCmd } from "../../utils";

import { EXPOSE_METHOD } from "~/agent/block-registry/registry.service";
import { provideBlockRegistry } from "~/agent/block-registry/test-utils";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

const testCases = [
  ["Alpine 3.14", testImages.testAlpine3_14],
  ["Debian Bookworm", testImages.testDebianBookworm],
  ["Debian Buster", testImages.testDebianBuster],
  ["Ubuntu Focal", testImages.testUbuntuFocal],
  ["Ubuntu Jammy", testImages.testUbuntuJammy],
];

test.concurrent.each(testCases)(`Boots and connects to %s`, async (name, remoteTag) =>
  provideBlockRegistry(async ({ injector, runId, brService }) => {
    const osIm = await brService.loadImageFromRemoteRepo(remoteTag, "osIm");
    const osCt = await brService.createContainer(osIm, "osCt");
    const osB = await brService.expose(osCt, EXPOSE_METHOD.BLOCK_DEV);
    const instance = injector.resolve(Token.QemuService)(runId);
    const vmInfo = await instance.withRuntime(
      {
        ssh: {
          username: "root",
          password: "root",
        },
        vcpuCount: 1,
        memSizeMib: 512,
        fs: { "/": osB },
        cleanupAfterStop: true,
        shouldPoweroff: true,
      },
      async ({ ssh }) => {
        await expect(execSshCmd({ ssh }, ["whoami"])).resolves.toHaveProperty("stdout", "root");
        return await instance.getRuntimeInfo();
      },
    );
    expect(vmInfo).not.toBeNull();
    expect(vmInfo?.status).toBe("on");
    expect(vmInfo?.info.instanceId).toBe(runId);

    // Ensure the VM was shut down
    await expect(instance.getRuntimeInfo()).resolves.toEqual(null);
    await expect(
      doesFileExist(path.join("/proc", (vmInfo?.info.pid as number).toString())),
    ).resolves.toEqual(false);
  })(),
);

test.concurrent.each(testCases)(`Properly handles multiple mounts on %s`, async (name, remoteTag) =>
  provideBlockRegistry(async ({ injector, runId, brService }) => {
    const [osIm, extraIm1, extraIm2] = await waitForPromises([
      brService.loadImageFromRemoteRepo(remoteTag, "osIm"),
      brService.loadImageFromRemoteRepo(testImages.test1, "extraIm1"),
      brService.loadImageFromRemoteRepo(testImages.test2, "extraIm2"),
    ]);
    const [osCt, extraCt1, extraCt2, extraCt3] = await waitForPromises([
      brService.createContainer(osIm, "osCt"),
      brService.createContainer(extraIm1, "extraCt1"),
      brService.createContainer(extraIm1, "extraCt2"),
      brService.createContainer(extraIm2, "extraCt3"),
    ]);
    // We will make 6 mounts, including 2 readonly ones
    const [osB, extraB1, extraB2, extraB3, extraB4, extraB5] = await waitForPromises(
      [osCt, extraCt1, extraCt2, extraCt3, extraIm1, extraIm2].map((what) =>
        brService.expose(what, EXPOSE_METHOD.BLOCK_DEV),
      ),
    );
    const instance = injector.resolve(Token.QemuService)(runId);
    await instance.withRuntime(
      {
        ssh: {
          username: "root",
          password: "root",
        },
        vcpuCount: 1,
        memSizeMib: 512,
        fs: {
          "/": osB,
          "/mount1rw": extraB1,
          "/mount2rw": extraB2,
          "/mount3rw": extraB3,
          "/mount4ro": extraB4,
          "/very/deeply/nested/non/existing/ro/mount/point": extraB5,
        },
        cleanupAfterStop: true,
        shouldPoweroff: true,
      },
      async ({ ssh }) => {
        const mountInfo = await (await execSshCmd({ ssh }, ["cat", "/proc/self/mountinfo"])).stdout;
        // Assert mount options
        expect(mountInfo).toMatch(/^.*?\/.*?ext4 .*? rw,discard$/gm);
        expect(mountInfo).toMatch(/^.*?\/mount1rw.*?ext4 .*? rw,discard$/gm);
        expect(mountInfo).toMatch(/^.*?\/mount2rw.*?ext4 .*? rw,discard$/gm);
        expect(mountInfo).toMatch(/^.*?\/mount3rw.*?ext4 .*? rw,discard$/gm);
        expect(mountInfo).toMatch(/^.*?\/mount4ro.*?ext4 .*? ro$/gm);
        expect(mountInfo).toMatch(
          /^.*?\/very\/deeply\/nested\/non\/existing\/ro\/mount\/point.*?ext4 .*? ro$/gm,
        );
        // Assert mount contents :)
        const im1Content = "This is layer 2a";
        const im2Content = "This is layer 2b";
        await waitForPromises(
          [
            ["/mount1rw/fileBA", im1Content],
            ["/mount2rw/fileBA", im1Content],
            ["/mount3rw/fileBB", im2Content],
            ["/mount4ro/fileBA", im1Content],
            ["/very/deeply/nested/non/existing/ro/mount/point/fileBB", im2Content],
          ].map(([path, content]) =>
            expect(execSshCmd({ ssh }, ["cat", path])).resolves.toHaveProperty("stdout", content),
          ),
        );
      },
    );
  })(),
);
