import type { ChildProcessWithoutNullStreams } from "child_process";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { formatWithOptions } from "util";

import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "../agent-injector";
import { execCmdAsync, ExecCmdError, execCmdWithOptsAsync } from "../utils";

import type { BlockRegistryService, ContainerId, ImageId } from "./registry.service";
import { EXPOSE_METHOD } from "./registry.service";
import testImages from "./test-data/test_images.json";

import { config as defaultConfig } from "~/config";
import { Scope } from "~/di/injector.server";
import { printErrors } from "~/test-utils";
import { Token } from "~/token";
import { sleep, waitForPromises } from "~/utils.shared";

const provideBlockRegistry = (
  testFn: (args: {
    injector: ReturnType<typeof createAgentInjector>;
    brService: BlockRegistryService;
    runId: string;
  }) => Promise<void>,
  opts: {
    skipInit: boolean;
  } = {
    skipInit: false,
  },
): (() => Promise<void>) => {
  const runId = uuidv4();
  const testsDir = "/srv/jailer/tests/";
  const testRunDir = path.join(testsDir, runId);
  const blockRegistryRoot = path.join(testRunDir, "block-registry");
  const injector = createAgentInjector({
    [Token.Logger]: {
      provide: {
        factory: function () {
          const format = formatWithOptions.bind(undefined, { colors: true });
          return new DefaultLogger("ERROR", (entry) => {
            entry.meta = entry.meta === void 0 ? {} : entry.meta;
            entry.meta["runId"] = runId;
            const { level, timestampNanos, message, meta } = entry;
            const date = new Date(Number(timestampNanos / 1000000n));
            process.stderr.write(`${format(date)} [${level}] [${format(meta)}] ${message} \n`);
          });
        },
      },
      scope: Scope.Transient,
    },
    [Token.Config]: {
      provide: {
        value: {
          ...defaultConfig,
          agent: () => ({ ...defaultConfig.agent(), blockRegistryRoot }),
        },
      },
    },
  });
  let shouldTerminate = false;
  let tcmuSubprocess: [ChildProcessWithoutNullStreams, Promise<void>] | undefined = void 0;
  let tcmuStdout = "";
  let tcmuStderr = "";
  let keepStorage = false;
  return printErrors(async () => {
    if (!opts.skipInit) {
      await fs.mkdir(testRunDir, { recursive: true });
    }
    const brService = injector.resolve(Token.BlockRegistryService);
    try {
      let cpWait: Promise<void>;
      if (!opts.skipInit) {
        await brService.initializeRegistry();
        const cp = spawn("/opt/overlaybd/bin/overlaybd-tcmu", [
          path.join(blockRegistryRoot, "overlaybd.json"),
        ]);
        cpWait = new Promise<void>((resolve, reject) => {
          cp.stdout.on("data", (data) => {
            tcmuStdout += data;
          });
          cp.stderr.on("data", (data) => {
            tcmuStderr += data;
          });
          cp.on("error", reject);
          cp.on("close", (code) => {
            if (!shouldTerminate) {
              // eslint-disable-next-line no-console
              console.error(`[${runId}] overlaybd-tcmu exited prematurely with code ${code}`);
              // eslint-disable-next-line no-console
              console.error(`[${runId}] overlaybd-tcmu STDOUT: ${tcmuStdout}`);
              // eslint-disable-next-line no-console
              console.error(`[${runId}] overlaybd-tcmu STDERR: ${tcmuStderr}`);
              // eslint-disable-next-line no-console
              console.error(`[${runId}] Please consult the artifacts for more details`);
              reject("overlaybd-tcmu exited");
            } else {
              resolve(void 0);
            }
          });
        });
        // Wait for tcmu to overlaybd to fully initialize
        for (let i = 0; i < 100; i += 1) {
          try {
            await fs.readFile(path.join(blockRegistryRoot, "logs", "overlaybd.log"), "utf-8");
            break;
          } catch (err) {
            await sleep(5);
          }
          if (i == 99) {
            throw new Error("TCMU failed to initialize");
          }
        }

        tcmuSubprocess = [cp, cpWait];
      } else {
        cpWait = Promise.resolve();
      }
      const testPromise = testFn({ brService, injector, runId });
      // Either the test finishes/crashes or overlaybd crashes/finishes
      await Promise.race([testPromise, cpWait]);
    } catch (err) {
      if (process.env["BUILDKITE_AGENT_ACCESS_TOKEN"] !== void 0) {
        const archivePath = testRunDir + ".tar.gz";
        // TODO: Perhaps only upload the logs?
        await execCmdAsync("tar", "-zcf", archivePath, "-C", testsDir, runId);
        try {
          await execCmdWithOptsAsync(["buildkite-agent", "artifact", "upload", runId + ".tar.gz"], {
            cwd: testsDir,
          });
        } finally {
          await fs.unlink(archivePath);
        }
        // eslint-disable-next-line no-console
        console.error(`Failed run id: ${runId}. Please consult the artifact ${runId}.tar.gz`);
      } else {
        // eslint-disable-next-line no-console
        console.error(
          `Failed run id: ${runId}. Please investigate ../hocus-resources/tests/${runId}`,
        );
        keepStorage = true;
      }
      throw err;
    } finally {
      if (!opts.skipInit) {
        // First check the kernel logs cause if we borked the kernel then
        // all sanity is gone and the cleanup will probably hang .-.
        await ensureKernelDidNotBlowUp();
        try {
          // Check if we have the subtype
          await brService.getTCMUSubtype();
          await brService.hideEverything();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[${runId}] Failed to cleanup registry ${(err as Error).message}`);
        }
        if (!keepStorage) {
          await fs.rm(testRunDir, { recursive: true, force: true });
        }
      }
      if (tcmuSubprocess !== void 0) {
        shouldTerminate = true;
        tcmuSubprocess[0].kill("SIGINT");
        await tcmuSubprocess[1];
      }

      await injector.dispose();
    }
  }, runId);
};

// I have never suspected that I legitimately need to worry about this case
async function ensureKernelDidNotBlowUp() {
  try {
    // Grep returns status 1 when no matches were found
    await execCmdAsync(
      "bash",
      "-c",
      'dmesg | grep -i -E "Kernel BUG|invalid opcode|corruption|Code:"',
    );
    // eslint-disable-next-line no-console
    console.error((await execCmdAsync("dmesg")).stdout);
    throw new Error("Looks like the kernel blew up, please reboot the CI machine...");
  } catch (err) {
    if (err instanceof ExecCmdError && (err as ExecCmdError).status !== 1) throw err;
  }
}

test.concurrent(
  "Stability of tcmuStorageObjectId => lunId mapping",
  provideBlockRegistry(
    async ({ brService }) => {
      // Stability test - the id doesn't change between releases
      expect(brService.tcmuIdToLUN("random-string")).toEqual("13322996231709573508");
      expect(brService.tcmuIdToLUN("raccoons")).toEqual("12634500512917172457");
      expect(brService.tcmuIdToLUN("18446744073709551615")).toEqual("7702772950068300006");
    },
    { skipInit: true },
  ),
);

test.concurrent(
  "Stability of W-LUN detection",
  provideBlockRegistry(
    async ({ brService }) => {
      // Well known LUNs
      expect(brService.isWLun("4334325174361833876")).toEqual(true);
      expect(brService.isWLun("3018598453422375403")).toEqual(true);
      expect(brService.isWLun("632590477590774088")).toEqual(true);
      expect(brService.isWLun("4675257587543884155")).toEqual(true);
      expect(brService.isWLun("16486746511334031826")).toEqual(true);
      // Normal LUNs
      expect(brService.isWLun("3519114781173106877")).toEqual(false);
      expect(brService.isWLun("7541570494835722524")).toEqual(false);
      expect(brService.isWLun("4855227540551039743")).toEqual(false);
      expect(brService.isWLun("448555180398852958")).toEqual(false);
      expect(brService.isWLun("11234747867045710393")).toEqual(false);
    },
    { skipInit: true },
  ),
);

test.concurrent(
  "Test create/expose/hide/commit",
  provideBlockRegistry(async ({ brService }) => {
    const testFile1 = "hello-world";
    const testContent1 = "Hello World!";
    const testFile2 = "hello-world-2";
    const testContent2 = "Hello Hello World!";
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const c1Bd = await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);

    expect(c1Bd.readonly).toEqual(false);
    await expect(fs.access(c1Bd.device, fs.constants.O_RDONLY)).resolves.toBe(void 0);
    await expect(fs.access(c1Bd.device, fs.constants.O_RDWR)).resolves.toBe(void 0);
    // Test RWZ
    const c1Mount = await brService.expose(c1, EXPOSE_METHOD.HOST_MOUNT);
    expect(c1Mount.readonly).toEqual(false);
    await fs.writeFile(path.join(c1Mount.mountPoint, testFile1), testContent1);

    const im1 = await brService.commitContainer(c1, "im1");

    // Test im1 is readonly after exposing
    const im1Bd = await brService.expose(im1, EXPOSE_METHOD.BLOCK_DEV);
    expect(im1Bd.readonly).toEqual(true);
    const im1Mount = await brService.expose(im1, EXPOSE_METHOD.HOST_MOUNT);
    expect(im1Mount.readonly).toEqual(true);
    await expect(
      fs.writeFile(path.join(im1Mount.mountPoint, "test-readonly"), "Should fail"),
    ).rejects.toThrowError("EROFS: read-only file system");
    // Ok try to put another layer on top of the image
    const c2 = await brService.createContainer(im1, "c2");
    const c2Mount = await brService.expose(c2, EXPOSE_METHOD.HOST_MOUNT);
    await fs.writeFile(path.join(c2Mount.mountPoint, testFile2), testContent2);
    const im2 = await brService.commitContainer(c2, "im2");
    const im2Mount = await brService.expose(im2, EXPOSE_METHOD.HOST_MOUNT);
    await expect(fs.readFile(path.join(im2Mount.mountPoint, testFile1), "utf-8")).resolves.toEqual(
      testContent1,
    );
    await expect(fs.readFile(path.join(im2Mount.mountPoint, testFile2), "utf-8")).resolves.toEqual(
      testContent2,
    );
  }),
);

test.concurrent(
  "Test loadImageFromRemoteRepo",
  provideBlockRegistry(async ({ brService }) => {
    const im1 = await brService.loadImageFromRemoteRepo(testImages.test1, "im1");
    const im2 = await brService.loadImageFromRemoteRepo(testImages.test2, "im2");
    const im1Mount = await brService.expose(im1, EXPOSE_METHOD.HOST_MOUNT);
    const im2Mount = await brService.expose(im2, EXPOSE_METHOD.HOST_MOUNT);

    await expect(fs.readFile(path.join(im1Mount.mountPoint, "fileA"), "utf-8")).resolves.toEqual(
      "This is layer 1\n",
    );
    await expect(fs.readFile(path.join(im1Mount.mountPoint, "fileBA"), "utf-8")).resolves.toEqual(
      "This is layer 2a\n",
    );
    await expect(fs.readFile(path.join(im2Mount.mountPoint, "fileA"), "utf-8")).resolves.toEqual(
      "This is layer 1\n",
    );
    await expect(fs.readFile(path.join(im2Mount.mountPoint, "fileBB"), "utf-8")).resolves.toEqual(
      "This is layer 2b\n",
    );

    // Ensure layers aren't duplicated in storage
    // In the oci store we will have 2 manifests + 2 configs + 4 blobs
    // In the layer store we will have 4 blobs
    await expect(fs.readdir(brService["paths"]._sharedOCIBlobsDirSha256)).resolves.toHaveLength(
      2 + 2 + 4,
    );
    await expect(fs.readdir(brService["paths"].layers)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].images)).resolves.toHaveLength(2);
  }),
);

test.concurrent(
  "Test loadImageFromDisk",
  provideBlockRegistry(async ({ brService }) => {
    const loadF = async (tag: string, id: string) => {
      const p = path.join(brService["paths"].root, "../", id);
      await execCmdAsync(
        "skopeo",
        "copy",
        "--multi-arch",
        "system",
        "--dest-oci-accept-uncompressed-layers",
        `docker://${tag}`,
        `oci:${p}`,
      );
      return p;
    };

    const p1 = await loadF(testImages.test1, "im1");
    const p2 = await loadF(testImages.test2, "im2");
    const im1 = await brService.loadImageFromDisk(p1, "im1");
    const im2 = await brService.loadImageFromDisk(p2, "im2");
    const im1Mount = await brService.expose(im1, EXPOSE_METHOD.HOST_MOUNT);
    const im2Mount = await brService.expose(im2, EXPOSE_METHOD.HOST_MOUNT);

    await expect(fs.readFile(path.join(im1Mount.mountPoint, "fileA"), "utf-8")).resolves.toEqual(
      "This is layer 1\n",
    );
    await expect(fs.readFile(path.join(im1Mount.mountPoint, "fileBA"), "utf-8")).resolves.toEqual(
      "This is layer 2a\n",
    );
    await expect(fs.readFile(path.join(im2Mount.mountPoint, "fileA"), "utf-8")).resolves.toEqual(
      "This is layer 1\n",
    );
    await expect(fs.readFile(path.join(im2Mount.mountPoint, "fileBB"), "utf-8")).resolves.toEqual(
      "This is layer 2b\n",
    );

    // Ensure layers aren't duplicated in storage
    // In the oci store we will have 4 blobs
    // In the layer store we will have 4 blobs
    await expect(fs.readdir(brService["paths"]._sharedOCIBlobsDirSha256)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].layers)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].images)).resolves.toHaveLength(2);
  }),
);

test.concurrent(
  "Concurrency and idempotence of loadImageFromRemoteRepo",
  provideBlockRegistry(async ({ brService }) => {
    const tasks: Promise<ImageId>[][] = [[], []];
    // Low concurrency because skopeo is slow
    for (let i = 0; i < 3; i++) {
      tasks[0].push(brService.loadImageFromRemoteRepo(testImages.test1, "im1"));
      tasks[1].push(brService.loadImageFromRemoteRepo(testImages.test2, "im2"));
    }
    const res = await waitForPromises(tasks.map(waitForPromises));
    expect(res).toEqual([
      ["im_im1", "im_im1", "im_im1"],
      ["im_im2", "im_im2", "im_im2"],
    ]);

    // Loading another image under the id will fail
    await expect(brService.loadImageFromRemoteRepo(testImages.test2, "im1")).rejects.toThrowError(
      "Image with id im_im1 already exists",
    );
    await expect(brService.loadImageFromRemoteRepo(testImages.test1, "im2")).rejects.toThrowError(
      "Image with id im_im2 already exists",
    );

    // But everything is always idempotent
    await expect(brService.loadImageFromRemoteRepo(testImages.test1, "im1")).resolves.toEqual(
      "im_im1",
    );
    await expect(brService.loadImageFromRemoteRepo(testImages.test2, "im2")).resolves.toEqual(
      "im_im2",
    );

    // Ensure layers aren't duplicated in storage
    // In the oci store we will have 2 manifests + 2 configs + 4 blobs
    // In the layer store we will have 4 blobs
    await expect(fs.readdir(brService["paths"]._sharedOCIBlobsDirSha256)).resolves.toHaveLength(
      2 + 2 + 4,
    );
    await expect(fs.readdir(brService["paths"].layers)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].images)).resolves.toHaveLength(2);

    for (const dirName of await fs.readdir(brService["paths"].layers)) {
      const layerPath = path.join(brService["paths"].layers, dirName, "layer.tar");
      const layerDigest = `sha256:${
        (await execCmdAsync("sha256sum", layerPath)).stdout.split(" ")[0]
      }`;
      // Check for data corruption
      expect(layerDigest).toEqual(dirName);
      // Check if that layer is hardlinked to the shared oci dir
      await expect(fs.stat(layerPath)).resolves.toHaveProperty("nlink", 2);
      await expect(
        fs.stat(path.join(brService["paths"].sharedOCIBlobsDir, dirName.replace(":", "/"))),
      ).resolves.toHaveProperty("nlink", 2);
    }
  }),
);

test.concurrent(
  "Concurrency and idempotence of loadImageFromDisk",
  provideBlockRegistry(async ({ brService }) => {
    const loadF = async (tag: string, id: string) => {
      const p = path.join(brService["paths"].root, "../", id);
      await execCmdAsync(
        "skopeo",
        "copy",
        "--multi-arch",
        "system",
        "--dest-oci-accept-uncompressed-layers",
        `docker://${tag}`,
        `oci:${p}`,
      );
      return p;
    };
    const p1 = await loadF(testImages.test1, "im1");
    const p2 = await loadF(testImages.test2, "im2");

    const tasks: Promise<ImageId>[][] = [[], []];
    const N = 10;
    for (let i = 0; i < N; i++) {
      tasks[0].push(brService.loadImageFromDisk(p1, "im1"));
      tasks[1].push(brService.loadImageFromDisk(p2, "im2"));
    }
    const res = await waitForPromises(tasks.map(waitForPromises));
    expect(res).toEqual([Array(N).fill("im_im1"), Array(N).fill("im_im2")]);

    // Loading another image under the id will fail
    await expect(brService.loadImageFromDisk(p2, "im1")).rejects.toThrowError(
      "Image with id im_im1 already exists",
    );
    await expect(brService.loadImageFromDisk(p1, "im2")).rejects.toThrowError(
      "Image with id im_im2 already exists",
    );

    // But everything is always idempotent
    await expect(brService.loadImageFromDisk(p1, "im1")).resolves.toEqual("im_im1");
    await expect(brService.loadImageFromDisk(p2, "im2")).resolves.toEqual("im_im2");

    // Ensure layers aren't duplicated in storage
    // In the oci store we will have 4 blobs
    // In the layer store we will have 4 blobs
    await expect(fs.readdir(brService["paths"]._sharedOCIBlobsDirSha256)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].layers)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].images)).resolves.toHaveLength(2);

    for (const dirName of await fs.readdir(brService["paths"].layers)) {
      const layerPath = path.join(brService["paths"].layers, dirName, "layer.tar");
      const layerDigest = `sha256:${
        (await execCmdAsync("sha256sum", layerPath)).stdout.split(" ")[0]
      }`;
      // Check for data corruption
      expect(layerDigest).toEqual(dirName);
      // Check if that layer is hardlinked to the shared oci dir and the original dir
      const existsInP1 = await fs
        .stat(path.join(p1, "blobs", dirName.replace(":", "/")))
        .then(() => 1)
        .catch(() => 0);
      const existsInP2 = await fs
        .stat(path.join(p2, "blobs", dirName.replace(":", "/")))
        .then(() => 1)
        .catch(() => 0);
      await expect(fs.stat(layerPath)).resolves.toHaveProperty(
        "nlink",
        2 + existsInP1 + existsInP2,
      );
      await expect(
        fs.stat(path.join(brService["paths"].sharedOCIBlobsDir, dirName.replace(":", "/"))),
      ).resolves.toHaveProperty("nlink", 2 + existsInP1 + existsInP2);
    }
  }),
);

test.concurrent(
  "Concurrency and idempotence of createContainer",
  provideBlockRegistry(async ({ brService }) => {
    const tasks: Promise<any>[][] = [[], []];
    const N = 5;
    for (let i = 0; i < N; i++) {
      tasks[0].push(brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 }));
      tasks[1].push(brService.createContainer(void 0, "c2", { mkfs: true, sizeInGB: 64 }));
    }
    const res = await waitForPromises(tasks.map(waitForPromises));
    const c1 = res[0][0];
    const c2 = res[1][0];
    expect(res).toEqual([Array(N).fill(c1), Array(N).fill(c2)]);
    // Sanity check the container works
    await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    await brService.expose(c2, EXPOSE_METHOD.BLOCK_DEV);
  }),
);

test.concurrent(
  "Concurrency and idempotence of commitContainer",
  provideBlockRegistry(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const c2 = await brService.createContainer(void 0, "c2", { mkfs: true, sizeInGB: 64 });
    const tasks: Promise<any>[][] = [[], []];
    // No need for heavy racing, this already tests the worst case
    const N = 2;
    for (let i = 0; i < N; i++) {
      tasks[0].push(brService.commitContainer(c1, "im1"));
      tasks[1].push(brService.commitContainer(c2, "im2"));
    }
    const res = await waitForPromises(tasks.map(waitForPromises));
    const im1 = res[0][0];
    const im2 = res[1][0];
    expect(res).toEqual([Array(N).fill(im1), Array(N).fill(im2)]);
    // Sanity check the image works
    await brService.expose(im1, EXPOSE_METHOD.BLOCK_DEV);
    await brService.expose(im2, EXPOSE_METHOD.BLOCK_DEV);
  }),
);

test.concurrent(
  "Concurrency and idempotence of expose",
  provideBlockRegistry(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const c2 = await brService.createContainer(void 0, "c2", { mkfs: true, sizeInGB: 64 });
    // Do 5 runs to ensure we don't have races
    // Especially when i first wrote this test the kernel literally blew up...
    // https://lore.kernel.org/lkml/5f637569-36af-a8d0-e378-b27a63f08501@gmail.com/
    for (let run = 0; run < 5; run++) {
      const tasks: Promise<any>[][] = [[], [], [], []];
      const N = 5;
      for (let i = 0; i < N; i++) {
        tasks[0].push(brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV));
        tasks[1].push(brService.expose(c1, EXPOSE_METHOD.HOST_MOUNT));
        tasks[2].push(brService.expose(c2, EXPOSE_METHOD.BLOCK_DEV));
        tasks[3].push(brService.expose(c2, EXPOSE_METHOD.HOST_MOUNT));
      }
      const res = await waitForPromises(tasks.map(waitForPromises));
      expect(res).toEqual([
        Array(N).fill(res[0][0]),
        Array(N).fill(res[1][0]),
        Array(N).fill(res[2][0]),
        Array(N).fill(res[3][0]),
      ]);
      await waitForPromises([brService.hide(c1), brService.hide(c2)]);
    }
  }),
);

test.concurrent(
  "Concurrency and idempotence of hide",
  provideBlockRegistry(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const c2 = await brService.createContainer(void 0, "c2", { mkfs: true, sizeInGB: 64 });
    for (let run = 0; run < 5; run++) {
      await waitForPromises([
        brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV),
        brService.expose(c2, EXPOSE_METHOD.BLOCK_DEV),
      ]);
      const tasks: Promise<any>[] = [];
      const N = 5;
      for (let i = 0; i < N; i++) {
        tasks.push(brService.hide(c1));
        tasks.push(brService.hide(c2));
      }
      await waitForPromises(tasks);
    }
  }),
);

test.concurrent(
  "LUN placement - Handles LUN collisions",
  provideBlockRegistry(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const c2 = await brService.createContainer(void 0, "c2", { mkfs: true, sizeInGB: 64 });
    // So multiple concurrent test runs of the same test don't collide with each other
    let randLun = brService.tcmuIdToLUN(uuidv4());
    while (
      brService.isWLun(randLun) ||
      brService.isWLun((BigInt(randLun) + 1n).toString()) ||
      brService.isWLun((BigInt(randLun) + 2n).toString()) ||
      brService.isWLun((BigInt(randLun) + 3n).toString()) ||
      randLun === (2n ** 64n - 1n).toString()
    ) {
      randLun = brService.tcmuIdToLUN(uuidv4());
    }
    const lunId = BigInt(randLun);
    const tcmuSubtype = await brService.getTCMUSubtype();
    const hostBusTargetAddr = await brService.getTCMLoopHostBusTarget();
    brService.tcmuIdToLUN = (id) => {
      switch (id) {
        case `${tcmuSubtype}_${c1}`:
          return randLun;
        case `${tcmuSubtype}_${c2}`:
          return randLun;
        case `${lunId}`:
          return (lunId + 1n).toString();
        case `${lunId + 1n}`:
          return (lunId + 2n).toString();
        case `${lunId + 2n}`:
          return (lunId + 3n).toString();
        default:
          throw new Error(`Unhandled ${id} in mock hash function`);
      }
    };
    const b1 = await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    const b2 = await brService.expose(c2, EXPOSE_METHOD.BLOCK_DEV);
    // Check the final lun placement
    expect(
      await fs.readdir(`/sys/class/block/${b1.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${lunId}`]);
    expect(
      await fs.readdir(`/sys/class/block/${b2.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${lunId + 1n}`]);
  }),
);

test.concurrent(
  "LUN placement - Never uses Well Known LUNs",
  provideBlockRegistry(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    // So multiple concurrent test runs of the same test don't collide with each other
    let randLun = brService.tcmuIdToLUN(uuidv4());
    while (
      brService.isWLun(randLun) ||
      brService.isWLun((BigInt(randLun) + 1n).toString()) ||
      brService.isWLun((BigInt(randLun) + 2n).toString()) ||
      brService.isWLun((BigInt(randLun) + 3n).toString()) ||
      randLun === (2n ** 64n - 1n).toString()
    ) {
      randLun = brService.tcmuIdToLUN(uuidv4());
    }
    let wLun = brService.tcmuIdToLUN(uuidv4());
    while (!brService.isWLun(wLun) || randLun === (2n ** 64n - 1n).toString()) {
      wLun = brService.tcmuIdToLUN(uuidv4());
    }
    const lunId = BigInt(randLun);
    const tcmuSubtype = await brService.getTCMUSubtype();
    const hostBusTargetAddr = await brService.getTCMLoopHostBusTarget();
    brService.tcmuIdToLUN = (id) => {
      switch (id) {
        case `${tcmuSubtype}_${c1}`:
          return wLun;
        case `${wLun}`:
          return lunId.toString();
        case `${lunId}`:
          return (lunId + 1n).toString();
        case `${lunId + 1n}`:
          return (lunId + 2n).toString();
        case `${lunId + 2n}`:
          return (lunId + 3n).toString();
        default:
          throw new Error(`Unhandled ${id} in mock hash function`);
      }
    };
    const b1 = await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    // Check the final lun placement
    expect(
      await fs.readdir(`/sys/class/block/${b1.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${lunId}`]);
  }),
);

test.concurrent(
  "LUN placement - Throws when fixed point + hash collision in hash function",
  provideBlockRegistry(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const c2 = await brService.createContainer(void 0, "c2", { mkfs: true, sizeInGB: 64 });
    // So multiple concurrent test runs of the same test don't collide with each other
    let randLun = brService.tcmuIdToLUN(uuidv4());
    while (brService.isWLun(randLun) || randLun === (2n ** 64n - 1n).toString()) {
      randLun = brService.tcmuIdToLUN(uuidv4());
    }
    const lunId = BigInt(randLun);
    const tcmuSubtype = await brService.getTCMUSubtype();
    const hostBusTargetAddr = await brService.getTCMLoopHostBusTarget();
    brService.tcmuIdToLUN = (id) => {
      switch (id) {
        case `${tcmuSubtype}_${c1}`:
          return randLun;
        case `${tcmuSubtype}_${c2}`:
          return randLun;
        case `${lunId}`:
          return randLun;
        default:
          throw new Error(`Unhandled ${id} in mock hash function`);
      }
    };
    const b1 = await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    await expect(brService.expose(c2, EXPOSE_METHOD.BLOCK_DEV)).rejects.toThrowError(
      "hash cycle detected",
    );
    // Check the final lun placement
    expect(
      await fs.readdir(`/sys/class/block/${b1.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${lunId}`]);
  }),
);

test.concurrent(
  "LUN placement - Throws when loop + hash collision in hash function",
  provideBlockRegistry(async ({ brService }) => {
    // 4 containers will be placed, but not the fifth
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const c2 = await brService.createContainer(void 0, "c2", { mkfs: true, sizeInGB: 64 });
    const c3 = await brService.createContainer(void 0, "c3", { mkfs: true, sizeInGB: 64 });
    const c4 = await brService.createContainer(void 0, "c4", { mkfs: true, sizeInGB: 64 });
    const c5 = await brService.createContainer(void 0, "c5", { mkfs: true, sizeInGB: 64 });
    // So multiple concurrent test runs of the same test don't collide with each other
    let randLun = brService.tcmuIdToLUN(uuidv4());
    while (
      brService.isWLun(randLun) ||
      brService.isWLun((BigInt(randLun) + 1n).toString()) ||
      brService.isWLun((BigInt(randLun) + 2n).toString()) ||
      brService.isWLun((BigInt(randLun) + 3n).toString()) ||
      randLun === (2n ** 64n - 1n).toString()
    ) {
      randLun = brService.tcmuIdToLUN(uuidv4());
    }
    const lunId = BigInt(randLun);
    const tcmuSubtype = await brService.getTCMUSubtype();
    const hostBusTargetAddr = await brService.getTCMLoopHostBusTarget();
    brService.tcmuIdToLUN = (id) => {
      switch (id) {
        case `${tcmuSubtype}_${c1}`:
          return randLun;
        case `${tcmuSubtype}_${c2}`:
          return randLun;
        case `${tcmuSubtype}_${c3}`:
          return randLun;
        case `${tcmuSubtype}_${c4}`:
          return randLun;
        case `${tcmuSubtype}_${c5}`:
          return randLun;
        case `${lunId}`:
          return (lunId + 1n).toString();
        case `${lunId + 1n}`:
          return (lunId + 2n).toString();
        case `${lunId + 2n}`:
          return (lunId + 3n).toString();
        case `${lunId + 3n}`:
          return randLun;
        default:
          throw new Error(`Unhandled ${id} in mock hash function`);
      }
    };
    const b1 = await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    const b2 = await brService.expose(c2, EXPOSE_METHOD.BLOCK_DEV);
    const b3 = await brService.expose(c3, EXPOSE_METHOD.BLOCK_DEV);
    const b4 = await brService.expose(c4, EXPOSE_METHOD.BLOCK_DEV);
    await expect(brService.expose(c5, EXPOSE_METHOD.BLOCK_DEV)).rejects.toThrowError(
      "hash cycle detected",
    );
    // Check the final lun placement
    expect(
      await fs.readdir(`/sys/class/block/${b1.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${lunId}`]);
    expect(
      await fs.readdir(`/sys/class/block/${b2.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${lunId + 1n}`]);
    expect(
      await fs.readdir(`/sys/class/block/${b3.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${lunId + 2n}`]);
    expect(
      await fs.readdir(`/sys/class/block/${b4.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${lunId + 3n}`]);
  }),
);

test.concurrent(
  "LUN placement - Cleans up double assignments",
  provideBlockRegistry(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    // So multiple concurrent test runs of the same test don't collide with each other
    let randLun1 = brService.tcmuIdToLUN(uuidv4());
    while (brService.isWLun(randLun1) || randLun1 === (2n ** 64n - 1n).toString()) {
      randLun1 = brService.tcmuIdToLUN(uuidv4());
    }
    let randLun2 = brService.tcmuIdToLUN(uuidv4());
    while (brService.isWLun(randLun2) || randLun2 === (2n ** 64n - 1n).toString()) {
      randLun2 = brService.tcmuIdToLUN(uuidv4());
    }
    const tcmuSubtype = await brService.getTCMUSubtype();
    const hostBusTargetAddr = await brService.getTCMLoopHostBusTarget();
    brService.tcmuIdToLUN = (id) => {
      switch (id) {
        case `${tcmuSubtype}_${c1}`:
          return randLun1;
        default:
          throw new Error(`Unhandled ${id} in mock hash function`);
      }
    };
    const b1 = await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    // Check the final lun placement
    expect(
      await fs.readdir(`/sys/class/block/${b1.device.split("/").reverse()[0]}/device/scsi_disk`),
    ).toEqual([`${hostBusTargetAddr}:${randLun1}`]);
    await expect(brService["getTCMUAluaMembers"](`${tcmuSubtype}_${c1}`)).resolves.toEqual([
      randLun1,
    ]);
    const simulateRaceF = async () => {
      // Ok now let's simulate that during a race we made a double assignment
      // The comments of the expose method explain the case where it may happen
      await fs.mkdir(path.join(brService["paths"].tcmLoopTarget, "lun", `lun_${randLun2}`));
      await fs.symlink(
        path.join(brService["paths"].tcmuHBA, `${tcmuSubtype}_${c1}`),
        path.join(
          brService["paths"].tcmLoopTarget,
          "lun",
          `lun_${randLun2}`,
          `${tcmuSubtype}_${c1}`,
        ),
      );
      // Oh no...
      await expect(brService["getTCMUAluaMembers"](`${tcmuSubtype}_${c1}`)).resolves.toEqual([
        randLun1,
        randLun2,
      ]);
    };
    await simulateRaceF();
    // Check that expose/hide fixes the situation and returns the same block device as before
    await expect(brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV)).resolves.toEqual(b1);
    await expect(brService["getTCMUAluaMembers"](`${tcmuSubtype}_${c1}`)).resolves.toEqual([
      randLun1,
    ]);
    // Let's do it again but this time hide the block device
    await simulateRaceF();
    await expect(fs.stat(path.join(brService["paths"].tcmLoopTarget, "lun", `lun_${randLun2}`)))
      .resolves;
    await brService.hide(c1);
    await expect(
      fs.stat(path.join(brService["paths"].tcmLoopTarget, "lun", `lun_${randLun2}`)),
    ).rejects.toThrowError("ENOENT");
  }),
);

// TODO: The test works but takes 80s
// Reenable when:
// - We may just push the layers to an OCI registry, for that not a lot of additional work would be needed
//   like this test may create an oci-layout image which we may push using `crane push`
// - We start support sealing overlaybd layers - this way the commit would be instant
// - We replace the mount/umount binary with the mount/umount syscall
// - I've lost some hours in trying to build a base image with 200+ layers but:
//    * Overlayfs can't support more than 128 layers
//    * Kaniko builds invalid OCI images which cause segfaults during conversion into overlaybd format
test.concurrent.skip(
  "256 layers is max",
  provideBlockRegistry(async ({ brService }) => {
    let parentImgId: ImageId | undefined = void 0;
    for (let i = 0; i < 512; i += 1) {
      let mkfs = parentImgId === void 0;
      // eslint-disable-next-line no-console
      console.log(i);
      const ct: ContainerId = await brService.createContainer(parentImgId, `c${i}`, {
        mkfs,
        sizeInGB: 64,
      });
      if (i === 256) {
        await expect(brService.expose(ct, EXPOSE_METHOD.HOST_MOUNT)).rejects.toThrowError(
          "failed to create overlaybd device",
        );
        const logs = await fs.readFile(
          path.join(brService["paths"].logs, "overlaybd.log"),
          "utf-8",
        );
        expect(logs.includes("open too many files (256 > 255)")).toEqual(true);
        return;
      }
      const cMount = await brService.expose(ct, EXPOSE_METHOD.HOST_MOUNT);
      await fs.writeFile(path.join(cMount.mountPoint, `layer_${i}`), `Hello from layer ${i}`);
      parentImgId = await brService.commitContainer(ct, `im${i}`);
    }
  }),
);
