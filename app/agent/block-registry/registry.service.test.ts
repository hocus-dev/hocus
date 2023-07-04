import fs from "fs/promises";
import path from "path";

import portfinder from "portfinder";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "../agent-injector";
import { execCmd, execCmdWithOpts } from "../utils";

import type { ContainerId, ImageId } from "./registry.service";
import { CONTENT_TYPE } from "./registry.service";
import { BlockRegistryService } from "./registry.service";
import { EXPOSE_METHOD } from "./registry.service";
import { testImages } from "./test-data/test-images.const";

import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { sleep, waitForPromises } from "~/utils.shared";

jest.setTimeout(60000);

const noSetupEnv = new TestEnvironmentBuilder(createAgentInjector).withLateInits({
  brService: async ({ injector }) => injector.resolve(Token.BlockRegistryService),
});

const testEnv = new TestEnvironmentBuilder(createAgentInjector)
  .withTestLogging()
  .withBlockRegistry();

test.concurrent(
  "Stability of tcmuStorageObjectId => lunId mapping",
  noSetupEnv.run(async ({ brService }) => {
    // Stability test - the id doesn't change between releases
    expect(brService.tcmuIdToLUN("random-string")).toEqual("13322996231709573508");
    expect(brService.tcmuIdToLUN("raccoons")).toEqual("12634500512917172457");
    expect(brService.tcmuIdToLUN("18446744073709551615")).toEqual("7702772950068300006");
  }),
);

test.concurrent(
  "Stability of W-LUN detection",
  noSetupEnv.run(async ({ brService }) => {
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
  }),
);

test.concurrent(
  "Test create/expose/hide/commit",
  testEnv.run(async ({ brService }) => {
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
  "Test commit of container with deleted base image",
  testEnv.run(async ({ brService }) => {
    const im1 = await brService.loadImageFromRemoteRepo(testImages.test1, "im1");
    const ct1 = await brService.createContainer(im1, "ct1");
    await brService.removeContent(im1);
    const im2 = await brService.commitContainer(ct1, "im2");
    const imMount = await brService.expose(im2, EXPOSE_METHOD.HOST_MOUNT);
    await expect(fs.readFile(path.join(imMount.mountPoint, "fileA"), "utf-8")).resolves.toEqual(
      "This is layer 1\n",
    );
    await expect(fs.readFile(path.join(imMount.mountPoint, "fileBA"), "utf-8")).resolves.toEqual(
      "This is layer 2a\n",
    );
  }),
);

test.concurrent(
  "Test commit of container with lazy pulled base image",
  testEnv.run(async ({ brService }) => {
    const im1 = await brService.loadImageFromRemoteRepo(testImages.test1, "im1", {
      enableObdLazyPulling: true,
      disableObdDownload: true,
      eagerLayerDownloadThreshold: -1,
    });
    const ct1 = await brService.createContainer(im1, "ct1");
    const im2 = await brService.commitContainer(ct1, "im2");
    const imMount = await brService.expose(im2, EXPOSE_METHOD.HOST_MOUNT);
    await expect(fs.readFile(path.join(imMount.mountPoint, "fileA"), "utf-8")).resolves.toEqual(
      "This is layer 1\n",
    );
    await expect(fs.readFile(path.join(imMount.mountPoint, "fileBA"), "utf-8")).resolves.toEqual(
      "This is layer 2a\n",
    );
  }),
);

test.concurrent(
  "Test loadImageFromRemoteRepo",
  testEnv.run(async ({ brService }) => {
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
    // In the layer store we will have 4 blobs
    await expect(fs.readdir(brService["paths"].layers)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].blockConfig)).resolves.toHaveLength(2);
  }),
);

test.concurrent(
  "Test loadImageFromDisk",
  testEnv.run(async ({ brService }) => {
    const loadF = async (tag: string, id: string) => {
      const p = path.join(brService["paths"].root, "../", id);
      await execCmd(
        "skopeo",
        "copy",
        ...(process.env.OCI_PROXY ? ["--src-tls-verify=false"] : []),
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
    // In the layer store we will have 4 blobs
    await expect(fs.readdir(brService["paths"].layers)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].blockConfig)).resolves.toHaveLength(2);
  }),
);

test.concurrent(
  "Test enumeration",
  testEnv.run(async ({ brService }) => {
    await expect(brService.listContent()).resolves.toEqual([]);
    await expect(brService.listExposedContent()).resolves.toEqual([]);
    const [im1, ct1, ct2] = await waitForPromises([
      brService.loadImageFromRemoteRepo(testImages.test1, "im1"),
      brService.createContainer(void 0, "ct1", { mkfs: true, sizeInGB: 64 }),
      brService.createContainer(void 0, "ct2", { mkfs: true, sizeInGB: 64 }),
    ]);
    await expect(brService.hasContent(im1)).resolves.toEqual(true);
    await expect(brService.hasContent(ct1)).resolves.toEqual(true);
    await expect(brService.hasContent(ct2)).resolves.toEqual(true);
    await expect(brService.hasContent(BlockRegistryService.genContainerId("ct2"))).resolves.toEqual(
      true,
    );
    await expect(brService.hasContent(BlockRegistryService.genContainerId("ct3"))).resolves.toEqual(
      false,
    );
    await expect(brService.listContent().then((x) => x.sort())).resolves.toEqual([ct1, ct2, im1]);
    await expect(brService.listContent(CONTENT_TYPE.ANY).then((x) => x.sort())).resolves.toEqual([
      ct1,
      ct2,
      im1,
    ]);
    await expect(
      brService.listContent(CONTENT_TYPE.CONTAINER).then((x) => x.sort()),
    ).resolves.toEqual([ct1, ct2]);
    await expect(brService.listContent(CONTENT_TYPE.IMAGE).then((x) => x.sort())).resolves.toEqual([
      im1,
    ]);
    await expect(brService.wasExposed(ct1)).resolves.toEqual(false);
    await brService.expose(ct1, EXPOSE_METHOD.BLOCK_DEV);
    await expect(brService.wasExposed(ct1)).resolves.toEqual(true);
    await brService.expose(im1, EXPOSE_METHOD.BLOCK_DEV);
    await expect(brService.listExposedContent().then((x) => x.sort())).resolves.toEqual([ct1, im1]);
    await expect(
      brService.listExposedContent(CONTENT_TYPE.ANY).then((x) => x.sort()),
    ).resolves.toEqual([ct1, im1]);
    await expect(
      brService.listExposedContent(CONTENT_TYPE.CONTAINER).then((x) => x.sort()),
    ).resolves.toEqual([ct1]);
    await expect(
      brService.listExposedContent(CONTENT_TYPE.IMAGE).then((x) => x.sort()),
    ).resolves.toEqual([im1]);
  }),
);

test.concurrent(
  "Test removeContent & garbageCollect",
  testEnv.run(async ({ brService }) => {
    // First check that the registry is empty
    const usage1 = await brService.estimateStorageUsage();
    // TODO: https://stackoverflow.com/questions/53369407/include-tobecloseto-in-jest-tomatchobject
    expect(usage1.containers / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage1.containers / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage1.layers / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage1.layers / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage1.obdGzipCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage1.obdGzipCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage1.obdRegistryCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage1.obdRegistryCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);

    await expect(brService.listContent()).resolves.toEqual([]);
    // Then load an container and an image
    const [ct1, im1] = await waitForPromises([
      brService.createContainer(void 0, "ct1", { mkfs: true, sizeInGB: 64 }),
      brService.loadImageFromRemoteRepo(testImages.test1, "im1", {
        // Never pull the layers eagerly for this test
        enableObdLazyPulling: true,
        eagerLayerDownloadThreshold: -1,
      }),
    ]);
    // Check that the storage usage had increased
    await expect(brService.hasContent(ct1)).resolves.toEqual(true);
    await expect(brService.hasContent(im1)).resolves.toEqual(true);
    await expect(brService.listContent().then((x) => x.sort())).resolves.toEqual([ct1, im1]);
    const usage2 = await brService.estimateStorageUsage();
    expect(usage2.containers / 1024n / 1024n).toBeLessThanOrEqual(9);
    expect(usage2.containers / 1024n / 1024n).toBeGreaterThanOrEqual(8);
    // Due to lazy pulling we never started downloading the layers
    expect(usage2.layers / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage2.layers / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage2.obdGzipCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage2.obdGzipCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage2.obdRegistryCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage2.obdRegistryCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);

    // Ok now force overlaybd to load the image layers
    const mp = await brService.expose(im1, EXPOSE_METHOD.HOST_MOUNT);
    await waitForPromises([
      fs.readFile(path.join(mp.mountPoint, "fileA")),
      fs.readFile(path.join(mp.mountPoint, "fileBA")),
    ]);

    // Now check that the layers were actually downloaded
    const usage3 = await brService.estimateStorageUsage();
    expect(usage3.containers / 1024n / 1024n).toBeLessThanOrEqual(9);
    expect(usage3.containers / 1024n / 1024n).toBeGreaterThanOrEqual(8);
    // Perhaps we managed to download at least 1 MB
    expect(usage3.layers / 1024n / 1024n).toBeLessThanOrEqual(10);
    expect(usage3.layers / 1024n / 1024n).toBeGreaterThanOrEqual(1);
    expect(usage3.obdGzipCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage3.obdGzipCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage3.obdRegistryCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage3.obdRegistryCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);

    // Now delete the content
    await waitForPromises([ct1, im1].map(brService.removeContent.bind(brService)));
    // Check that the registry is empty
    await expect(brService.listContent()).resolves.toEqual([]);
    await expect(brService.hasContent(ct1)).resolves.toEqual(false);
    await expect(brService.hasContent(im1)).resolves.toEqual(false);
    // Now check the storage usage
    // Containers are deleted instantly but images need to be GCed
    const usage4 = await brService.estimateStorageUsage();
    expect(usage4.containers / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage4.containers / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage4.layers / 1024n / 1024n).toBeLessThanOrEqual(10);
    expect(usage4.layers / 1024n / 1024n).toBeGreaterThanOrEqual(1);
    expect(usage4.obdGzipCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage4.obdGzipCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage4.obdRegistryCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage4.obdRegistryCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);

    // GC the registry and check storage usage
    await brService.garbageCollect();
    const usage5 = await brService.estimateStorageUsage();
    expect(usage5.containers / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage5.containers / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage5.layers / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage5.layers / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage5.obdGzipCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage5.obdGzipCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage5.obdRegistryCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage5.obdRegistryCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);
  }),
);

test.concurrent(
  "Race loadImage/commit & removeContent & garbageCollect together",
  testEnv.run(async ({ brService }) => {
    // Shaves off a second in this test :)
    const loadOpts = {
      disableObdDownload: true,
      enableObdLazyPulling: true,
      eagerLayerDownloadThreshold: -1,
    };
    for (let i = 0; i < 10; i++) {
      const [ima, imb, ct1] = await waitForPromises([
        brService.loadImageFromRemoteRepo(testImages.test1, `imAPreDelete${i}`, loadOpts),
        brService.loadImageFromRemoteRepo(testImages.test2, `imBPreDelete${i}`, loadOpts),
        brService.createContainer(void 0, `ct1-${i}`, { mkfs: true, sizeInGB: 64 }),
      ]);
      await brService.removeContent(ima);
      await brService.removeContent(imb);
      const [imc, imd, ime, ct2, _gcRes] = await waitForPromises([
        brService.commitContainer(ct1 as ContainerId, `commit${i}`),
        brService.loadImageFromRemoteRepo(testImages.test1, `imAPostDelete${i}`, loadOpts),
        brService.loadImageFromRemoteRepo(testImages.test2, `imBPostDelete${i}`, loadOpts),
        brService.createContainer(void 0, `ct2-${i}`),
        brService.garbageCollect(),
      ]);
      await waitForPromises(
        [imc, imd, ime, ct2].map(async (imId) => {
          await brService.expose(imId as ImageId, EXPOSE_METHOD.BLOCK_DEV);
          await brService.removeContent(imId as ImageId);
        }),
      );
    }

    // GC the registry and check storage usage
    await brService.garbageCollect();
    const usage1 = await brService.estimateStorageUsage();
    expect(usage1.containers / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage1.containers / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage1.layers / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage1.layers / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage1.obdGzipCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage1.obdGzipCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    expect(usage1.obdRegistryCache / 1024n / 1024n).toBeLessThanOrEqual(1);
    expect(usage1.obdRegistryCache / 1024n / 1024n).toBeGreaterThanOrEqual(0);
    await expect(brService.listContent()).resolves.toEqual([]);
  }),
);

test.concurrent(
  "Concurrency and idempotence of loadImageFromRemoteRepo",
  testEnv.run(async ({ brService }) => {
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
    // In the layer store we will have 4 blobs
    await expect(fs.readdir(brService["paths"].layers)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].blockConfig)).resolves.toHaveLength(2);
  }),
);

test.concurrent(
  "Concurrency and idempotence of loadImageFromDisk",
  testEnv.run(async ({ brService }) => {
    const loadF = async (tag: string, id: string) => {
      const p = path.join(brService["paths"].root, "../", id);
      await execCmd(
        "skopeo",
        "copy",
        ...(process.env.OCI_PROXY ? ["--src-tls-verify=false"] : []),
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
    // In the layer store we will have 4 blobs
    await expect(fs.readdir(brService["paths"].layers)).resolves.toHaveLength(4);
    await expect(fs.readdir(brService["paths"].blockConfig)).resolves.toHaveLength(2);

    for (const dirName of await fs.readdir(brService["paths"].layers)) {
      const layerPath = path.join(brService["paths"].layers, dirName, "overlaybd.commit");
      const layerDigest = `sha256:${(await execCmd("sha256sum", layerPath)).stdout.split(" ")[0]}`;
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
        1 + existsInP1 + existsInP2,
      );
    }
  }),
);

test.concurrent(
  "Concurrency and idempotence of createContainer",
  testEnv.run(async ({ brService }) => {
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
    // Sanity check that the container works
    await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    await brService.expose(c2, EXPOSE_METHOD.BLOCK_DEV);
  }),
);

test.concurrent(
  "Concurrency and idempotence of commitContainer",
  testEnv.run(async ({ brService }) => {
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
    // Sanity check that the image works
    await brService.expose(im1, EXPOSE_METHOD.BLOCK_DEV);
    await brService.expose(im2, EXPOSE_METHOD.BLOCK_DEV);
  }),
);

test.concurrent(
  "Test commit without removing the container",
  testEnv.run(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const im1 = await brService.commitContainer(c1, "im1", { removeContainer: false });
    await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    await brService.expose(im1, EXPOSE_METHOD.BLOCK_DEV);
  }),
);

test.concurrent(
  "Concurrency and idempotence of expose",
  testEnv.run(async ({ brService }) => {
    const c1 = await brService.createContainer(void 0, "c1", { mkfs: true, sizeInGB: 64 });
    const c2 = await brService.createContainer(void 0, "c2", { mkfs: true, sizeInGB: 64 });
    // Do 5 runs to ensure we don't have races
    // Especially when I first wrote this test the kernel literally blew up...
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
  testEnv.run(async ({ brService }) => {
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
  testEnv.run(async ({ brService }) => {
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
  testEnv.run(async ({ brService }) => {
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
  testEnv.run(async ({ brService }) => {
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
  testEnv.run(async ({ brService }) => {
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
  testEnv.run(async ({ brService }) => {
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
      // Oh, no...
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
    // Let's do it again, but this time hide the block device
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
  testEnv.run(async ({ brService }) => {
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

test.concurrent(
  "Concurrent image pushImage",
  testEnv.run(async ({ brService }) => {
    const writeToNewImage = async (
      imageId: ImageId | undefined,
      outputId: string,
      contents: string,
    ): Promise<ImageId> => {
      const ctId = await BlockRegistryService.genContainerId(outputId);
      const ct: ContainerId = await brService.createContainer(imageId, ctId, {
        mkfs: imageId === void 0,
        sizeInGB: 64,
      });
      const cMount = await brService.expose(ct, EXPOSE_METHOD.HOST_MOUNT);
      await fs.writeFile(path.join(cMount.mountPoint, "test"), contents);
      return brService.commitContainer(ct, outputId);
    };
    const im1 = await writeToNewImage(void 0, "im1", "test");
    const im2 = await writeToNewImage(im1, "im2", "roast");
    const im3 = await writeToNewImage(im2, "im3", "brother");

    const ac = new AbortController();
    const [registryPromise, port] = await portfinder.getPortPromise().then(async (port) => {
      const promise = execCmdWithOpts(["crane", "registry", "serve"], {
        env: { PORT: port.toString() },
        signal: ac.signal,
      });
      // give the registry some time to start or error out
      await Promise.race([sleep(250), promise]);
      return [promise, port] as const;
    });
    try {
      const tag1 = `localhost:${port}/hocus/push-test:tag-1`;
      const tag2 = `localhost:${port}/hocus/push-test:tag-2`;
      const opts = {
        username: "username",
        password: "password",
      };
      await waitForPromises([
        brService.pushImage(im3, { tag: tag1, ...opts }),
        brService.pushImage(im3, { tag: tag1, ...opts }),
      ]);
      // Clear the registry
      await waitForPromises(
        (await brService.listContent()).map(brService.removeContent.bind(brService)),
      );
      await brService.garbageCollect();
      await expect(brService.listContent()).resolves.toEqual([]);
      const im4 = await brService.loadImageFromRemoteRepo(tag1, "im4", {
        skipVerifyTls: true,
        disableObdDownload: true,
        enableObdLazyPulling: true,
        eagerLayerDownloadThreshold: -1,
      });
      const { mountPoint: mountPoint2 } = await brService.expose(im4, EXPOSE_METHOD.HOST_MOUNT);
      await expect(fs.readFile(path.join(mountPoint2, "test"), "utf-8")).resolves.toEqual(
        "brother",
      );
      await brService.hide(im4);
      const ct1Id = await brService.createContainer(im4, "ct1");
      const { mountPoint: mountPoint3 } = await brService.expose(ct1Id, EXPOSE_METHOD.HOST_MOUNT);
      const writeData = "hello";
      await fs.writeFile(path.join(mountPoint3, "test2"), writeData);
      const readData = await fs.readFile(path.join(mountPoint3, "test2")).then((b) => b.toString());
      expect(readData).toEqual(writeData);

      const im5 = await brService.commitContainer(ct1Id, "im5");
      // Try pushing the container again now that it has lazy pulled layers
      await waitForPromises([
        brService.pushImage(im5, { tag: tag2, ...opts }),
        brService.pushImage(im5, { tag: tag2, ...opts }),
      ]);
    } finally {
      // the registry child process will be killed even if this code does not
      // run in case of a sigkill, because it will die along with its parent - jest
      ac.abort();
      await registryPromise.catch(() => {});
    }
  }),
);

test.concurrent("extractOutputId", async () => {
  const outputId = "hello-there";
  const imageId = BlockRegistryService.genImageId(outputId);
  const containerId = BlockRegistryService.genContainerId(outputId);
  expect(BlockRegistryService.extractOutputId(imageId)).toEqual(outputId);
  expect(BlockRegistryService.extractOutputId(containerId)).toEqual(outputId);
});

test.concurrent(
  "output id max length",
  testEnv.run(async ({ brService }) => {
    const outputId = Array.from({ length: BlockRegistryService.maxOutputIdLength })
      .map((_) => "1")
      .join("");
    const ctId = await brService.createContainer(void 0, outputId, { mkfs: true, sizeInGB: 64 });
    await brService.expose(ctId, EXPOSE_METHOD.HOST_MOUNT);
    await brService.hide(ctId);

    await expect(
      brService.createContainer(void 0, outputId + "1", { mkfs: true, sizeInGB: 64 }),
    ).rejects.toThrow(/is too long/);
  }),
);
