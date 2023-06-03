import testImages from "../../block-registry/test-data/test_images.json";
import { execSshCmd, isProcessAlive, sleep } from "../../utils";

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

test.concurrent.each(testCases)(`Boots and connects to %s`, async (_name, remoteTag) =>
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
        memSizeMib: 128,
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
    await expect(isProcessAlive(vmInfo?.info.pid as number)).resolves.toEqual(false);
  })(),
);

test.concurrent.each(testCases)(
  `Properly handles multiple mounts on %s`,
  async (_name, remoteTag) =>
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
          memSizeMib: 128,
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
          const mountInfo = await (
            await execSshCmd({ ssh }, ["cat", "/proc/self/mountinfo"])
          ).stdout;
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

test.concurrent.each(testCases)(
  `If requested then keeps running in the background on %s`,
  async (_name, remoteTag) =>
    provideBlockRegistry(async ({ injector, runId, brService }) => {
      const osIm = await brService.loadImageFromRemoteRepo(remoteTag, "osIm");
      const osCt = await brService.createContainer(osIm, "osCt");
      const osB = await brService.expose(osCt, EXPOSE_METHOD.BLOCK_DEV);
      const instance = injector.resolve(Token.QemuService)(runId);
      const vmInfo1 = await instance.withRuntime(
        {
          ssh: {
            username: "root",
            password: "root",
          },
          vcpuCount: 1,
          memSizeMib: 128,
          fs: { "/": osB },
          cleanupAfterStop: false,
          shouldPoweroff: false,
        },
        async (_args) => {
          return await instance.getRuntimeInfo();
        },
      );
      expect(vmInfo1).not.toBeNull();
      expect(vmInfo1?.status).toBe("on");
      expect(vmInfo1?.info.instanceId).toBe(runId);

      const vmInfo2 = await instance.getRuntimeInfo();
      expect(vmInfo2).not.toBeNull();
      expect(vmInfo2?.status).toBe("on");
      expect(vmInfo2?.info.instanceId).toBe(runId);

      await instance.cleanup();

      // Ensure the VM was shut down
      await expect(instance.getRuntimeInfo()).resolves.toEqual(null);
      await expect(isProcessAlive(vmInfo1?.info.pid as number)).resolves.toEqual(false);
    })(),
);

test.concurrent.each(
  testCases.flatMap(([name, remoteTag]) => [
    [["reboot"], name, remoteTag],
    [["poweroff"], name, remoteTag],
  ]),
)(`Doesn't hang forever after issuing %s on %s`, async (command, _name, remoteTag) =>
  provideBlockRegistry(async ({ injector, runId, brService }) => {
    const osIm = await brService.loadImageFromRemoteRepo(remoteTag, "osIm");
    const osCt = await brService.createContainer(osIm, "osCt");
    const osB = await brService.expose(osCt, EXPOSE_METHOD.BLOCK_DEV);
    const instance = injector.resolve(Token.QemuService)(runId);
    const vmInfo = await instance
      .withRuntime(
        {
          ssh: {
            username: "root",
            password: "root",
          },
          vcpuCount: 1,
          memSizeMib: 128,
          fs: { "/": osB },
          cleanupAfterStop: true,
          shouldPoweroff: true,
        },
        async ({ ssh }) => {
          const info = await instance.getRuntimeInfo();
          // Cause ssh might terminate unexpectedly, let the promise hang
          void execSshCmd({ ssh }, command).catch((_err) => void 0);
          await sleep(100);
          return info;
        },
      )
      .catch((err: any) => {
        // TODO: investigate this intermittent failure:
        /*
          write EPIPE
            at onWrite (node_modules/ssh2/lib/client.js:305:16)
            at AESGCMCipherBinding.Protocol._onWrite (node_modules/ssh2/lib/protocol/Protocol.js:116:33)
            at AESGCMCipherBinding.encrypt (node_modules/ssh2/lib/protocol/crypto.js:381:10)
            at sendPacket (node_modules/ssh2/lib/protocol/utils.js:353:19)
            at Protocol.channelClose (node_modules/ssh2/lib/protocol/Protocol.js:423:5)
            at Channel.close (node_modules/ssh2/lib/Channel.js:210:30)
            at onCHANNEL_CLOSE (node_modules/ssh2/lib/utils.js:62:13)
            at CHANNEL_CLOSE (node_modules/ssh2/lib/client.js:643:11)
            at 97 (node_modules/ssh2/lib/protocol/handlers.misc.js:928:16)
            at Protocol.onPayload (node_modules/ssh2/lib/protocol/Protocol.js:2025:10)
            at AESGCMDecipherBinding.decrypt (node_modules/ssh2/lib/protocol/crypto.js:1086:26)
            at Protocol.parsePacket [as _parse] (node_modules/ssh2/lib/protocol/Protocol.js:1994:25)
            at Protocol.parse (node_modules/ssh2/lib/protocol/Protocol.js:293:16)
            at Socket.<anonymous> (node_modules/ssh2/lib/client.js:713:21)
        */
        if (err?.message.includes("EPIPE") || err?.code.includes("EPIPE")) return;
        throw err;
      });
    expect(vmInfo).not.toBeNull();
    expect(vmInfo?.status).toBe("on");
    expect(vmInfo?.info.instanceId).toBe(runId);

    // Ensure the VM was shut down
    await expect(instance.getRuntimeInfo()).resolves.toEqual(null);
    await expect(isProcessAlive(vmInfo?.info.pid as number)).resolves.toEqual(false);
  })(),
);

test.concurrent.each(testCases)(
  `Doesn't hang forever when ssh is unresponsive on %s`,
  async (_name, remoteTag) =>
    provideBlockRegistry(async ({ injector, runId, brService }) => {
      const osIm = await brService.loadImageFromRemoteRepo(remoteTag, "osIm");
      const osCt = await brService.createContainer(osIm, "osCt");
      const osB = await brService.expose(osCt, EXPOSE_METHOD.BLOCK_DEV);
      const instance = injector.resolve(Token.QemuService)(runId);

      let sshCommandExitedWithin: number | null = null;
      let sshDone: (value: unknown) => void;
      let sshDonePromise = new Promise((resolve) => {
        sshDone = resolve;
      });
      await expect(
        instance.withRuntime(
          {
            ssh: {
              username: "root",
              password: "root",
            },
            vcpuCount: 1,
            memSizeMib: 128,
            fs: { "/": osB },
            cleanupAfterStop: true,
            shouldPoweroff: true,
          },
          async ({ ssh, runtimePid }) => {
            const now = Date.now();
            await waitForPromises([
              execSshCmd({ ssh }, ["sh", "-c", "sleep 1; echo 'a'"]).catch(() => {
                sshCommandExitedWithin = Date.now() - now;
                sshDone(void 0);
              }),
              (async () => {
                await sleep(500);
                process.kill(runtimePid, "SIGKILL");
              })(),
            ]);
          },
        ),
      ).rejects.toThrow();
      await sshDonePromise;
      expect(sshCommandExitedWithin).not.toBe(null);
      expect(sshCommandExitedWithin).toBeLessThan(5000);
    })(),
);

// Run those tests only on alpine, this test does not depend on the guest distro but on the guest kernel
test.concurrent.each(
  [testCases[0]].flatMap(([name, remoteTag]) => [
    [1, 128, name, remoteTag],
    [1, 256, name, remoteTag],
    [2, 128, name, remoteTag],
    [2, 256, name, remoteTag],
  ]),
)(
  `Creates vm with %d cores and %d MiB ram on %s`,
  async (vcpuCount, memSizeMib, _name, remoteTag) =>
    provideBlockRegistry(async ({ injector, runId, brService }) => {
      const osIm = await brService.loadImageFromRemoteRepo(remoteTag, "osIm");
      const osCt = await brService.createContainer(osIm, "osCt");
      const osB = await brService.expose(osCt, EXPOSE_METHOD.BLOCK_DEV);
      const instance = injector.resolve(Token.QemuService)(runId);
      await instance.withRuntime(
        {
          ssh: {
            username: "root",
            password: "root",
          },
          vcpuCount,
          memSizeMib,
          fs: { "/": osB },
          cleanupAfterStop: true,
          shouldPoweroff: true,
        },
        async ({ ssh }) => {
          const cpuInfo = (await execSshCmd({ ssh }, ["cat", "/proc/cpuinfo"])).stdout;
          expect(cpuInfo).toMatch(new RegExp(`^cpu cores.*?${vcpuCount}$`, "gm"));
          // Ram is more tricky and containers need a different test here
          // Assert that the memory block size on the guest is 128MB
          // block_size_bytes is in hex notation
          await expect(
            execSshCmd({ ssh }, ["cat", "/sys/devices/system/memory/block_size_bytes"]),
          ).resolves.toHaveProperty("stdout", "8000000");
          // Now check the amount of memory blocks on the system
          expect(
            (await execSshCmd({ ssh }, ["ls", "/sys/devices/system/memory/"])).stdout
              .split("\n")
              .filter((m) => m.startsWith("memory")),
          ).toHaveLength(memSizeMib / 128);
        },
      );
    })(),
);

test.concurrent(
  `Doesn't hang forever if qemu fails to start`,
  provideBlockRegistry(async ({ injector, runId, brService }) => {
    const osCt = await brService.createContainer(void 0, "emptyCt", { mkfs: true, sizeInGB: 64 });
    const osB = await brService.expose(osCt, EXPOSE_METHOD.BLOCK_DEV);
    const instance = injector.resolve(Token.QemuService)(runId);
    await expect(
      instance.withRuntime(
        {
          ssh: {
            username: "root",
            password: "root",
          },
          vcpuCount: 1,
          memSizeMib: 128,
          fs: { "/": osB },
          cleanupAfterStop: true,
          shouldPoweroff: true,
          kernelPath: "/tmp/very-legit-kernel-image",
        },
        async () => {},
      ),
    ).rejects.toThrow("closed: 1");
  }),
);

test.concurrent(
  `Doesn't hang forever if booting vm without /init`,
  provideBlockRegistry(async ({ injector, runId, brService }) => {
    const osCt = await brService.createContainer(void 0, "emptyCt", { mkfs: true, sizeInGB: 64 });
    const osB = await brService.expose(osCt, EXPOSE_METHOD.BLOCK_DEV);
    const instance = injector.resolve(Token.QemuService)(runId);
    await expect(
      instance.withRuntime(
        {
          ssh: {
            username: "root",
            password: "root",
          },
          vcpuCount: 1,
          memSizeMib: 128,
          fs: { "/": osB },
          cleanupAfterStop: true,
          shouldPoweroff: true,
        },
        async () => {},
      ),
    ).rejects.toThrow("closed: 0");
  }),
);

test.concurrent(
  `Doesn't hang forever if booting vm without ssh`,
  provideBlockRegistry(async ({ injector, runId, brService }) => {
    const osIm = await brService.loadImageFromRemoteRepo(testImages.testAlpine3_14NoSSH, "osIm");
    const osCt = await brService.createContainer(osIm, "osCt");
    const osB = await brService.expose(osCt, EXPOSE_METHOD.BLOCK_DEV);
    const instance = injector.resolve(Token.QemuService)(runId);
    await expect(
      instance.withRuntime(
        {
          ssh: {
            username: "root",
            password: "root",
          },
          vcpuCount: 1,
          memSizeMib: 128,
          fs: { "/": osB },
          cleanupAfterStop: true,
          shouldPoweroff: true,
        },
        async ({ ssh }) => {
          await expect(execSshCmd({ ssh }, ["whoami"])).resolves.toHaveProperty("stdout", "root");
          return await instance.getRuntimeInfo();
        },
      ),
    ).rejects.toThrow("ECONNREFUSED");
  }),
);
