import type { ChildProcessWithoutNullStreams } from "child_process";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "../agent-injector";
import { execCmd } from "../utils";

import type { BlockRegistryService } from "./registry.service";
import { EXPOSE_METHOD } from "./registry.service";
import testImages from "./test-data/test_images.json";

import { config as defaultConfig } from "~/config";
import { Scope } from "~/di/injector.server";
import { printErrors } from "~/test-utils";
import { Token } from "~/token";
import { sleep } from "~/utils.shared";

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
          return new DefaultLogger("ERROR");
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
          cp.on("close", (code) => {
            if (!shouldTerminate) {
              // eslint-disable-next-line no-console
              console.error(`overlaybd-tcmu exited prematurely with code ${code}`);
              // eslint-disable-next-line no-console
              console.error(`overlaybd-tcmu STDOUT: ${tcmuStdout}`);
              // eslint-disable-next-line no-console
              console.error(`overlaybd-tcmu STDERR: ${tcmuStderr}`);
              // eslint-disable-next-line no-console
              console.error("Please consult the artifacts for more details");
              reject("overlaybd-tcmu exited");
            } else {
              resolve(void 0);
            }
          });
        });
        // Wait for tcmu to overlaybd to fully initialize
        for (let i = 0; i < 10; i += 1) {
          try {
            await fs.readFile(path.join(blockRegistryRoot, "logs", "overlaybd.log"), "utf-8");
            break;
          } catch (err) {
            await sleep(10);
          }
          if (i == 9) {
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
        await execCmd("tar", "-zcf", archivePath, testRunDir);
        try {
          await execCmd("buildkite-agent", "artifact", "upload", archivePath);
        } finally {
          await fs.unlink(archivePath);
        }
        // eslint-disable-next-line no-console
        console.error(`Failed run id: ${runId}. Please consult ${runId}.tar.gz`);
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
        try {
          // Check if we have the subtype
          await brService.getTCMUSubtype();
          await brService.hideEverything();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`Failed to cleanup registry ${(err as Error).message}`);
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
  });
};

test.concurrent(
  "tcmuStorageObjectId => lunId mapping sanity check",
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
  "create => mkfs => mount => write => commit => create => write => commit",
  provideBlockRegistry(async ({ brService }) => {
    await sleep(5000);
    const testFile1 = "hello-world";
    const testContent1 = "Hello World!";
    const testFile2 = "hello-world-2";
    const testContent2 = "Hello Hello World!";
    const c1 = await brService.createContainer(void 0, "c1");
    const c1Bd = await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
    expect(c1Bd.readonly).toEqual(false);
    await expect(fs.access(c1Bd.device, fs.constants.O_RDONLY)).resolves.toBe(void 0);
    await expect(fs.access(c1Bd.device, fs.constants.O_RDWR)).resolves.toBe(void 0);
    // Test RW
    await execCmd("mkfs.ext4", c1Bd.device);
    const c1Mount = await brService.expose(c1, EXPOSE_METHOD.HOST_MOUNT);
    expect(c1Mount.readonly).toEqual(false);
    await fs.writeFile(path.join(c1Mount.mountPoint, testFile1), testContent1);
    await brService.hide(c1);
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
    await brService.hide(c2);
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
  "Load image from registry",
  provideBlockRegistry(async ({ brService }) => {
    const im1 = await brService.loadImageFromRemoteRepo(testImages.test1);
    const im2 = await brService.loadImageFromRemoteRepo(testImages.test2);
    const im1Mount = await brService.expose(im1, EXPOSE_METHOD.HOST_MOUNT);
    const im2Mount = await brService.expose(im2, EXPOSE_METHOD.HOST_MOUNT);

    await expect(fs.readFile(path.join(im1Mount.mountPoint, "fileA"), "utf-8")).resolves.toEqual(
      "This is layer 1",
    );
    await expect(fs.readFile(path.join(im1Mount.mountPoint, "fileBA"), "utf-8")).resolves.toEqual(
      "This is layer 2a",
    );
    await expect(fs.readFile(path.join(im2Mount.mountPoint, "fileA"), "utf-8")).resolves.toEqual(
      "This is layer 1",
    );
    await expect(fs.readFile(path.join(im2Mount.mountPoint, "fileBB"), "utf-8")).resolves.toEqual(
      "This is layer 2b",
    );
  }),
);
