import type { ChildProcessWithoutNullStreams } from "child_process";
import { spawn } from "child_process";
import path from "path";

import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "../agent-injector";

import type { BlockRegistryService } from "./registry.service";
import { EXPOSE_METHOD } from "./registry.service";
import testImages from "./test-data/test_images.json";

import { Scope } from "~/di/injector.server";
import { printErrors } from "~/test-utils";
import { Token } from "~/token";
import { sleep } from "~/utils.shared";

const provideInjector = (
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
  const injector = createAgentInjector({
    [Token.Logger]: {
      provide: {
        factory: function () {
          return new DefaultLogger("ERROR");
        },
      },
      scope: Scope.Transient,
    },
  });
  const runId = uuidv4();
  let shouldTerminate = false;
  let tcmuSubprocess: [ChildProcessWithoutNullStreams, Promise<void>] | undefined = void 0;
  let tcmuStdout = "";
  let tcmuStderr = "";
  return printErrors(async () => {
    try {
      const brService = injector.resolve(Token.BlockRegistryService);
      const config = injector.resolve(Token.Config);
      let cpWait: Promise<void>;
      if (!opts.skipInit) {
        await brService.initializeRegistry();
        const cp = spawn("/opt/overlaybd/bin/overlaybd-tcmu", [
          path.join(config.agent().blockRegistryRoot, "overlaybd.json"),
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
              console.error(`overlaybd-tcmu exited prematurely with code ${code}`);
              console.error(`overlaybd-tcmu STDOUT: ${tcmuStdout}`);
              console.error(`overlaybd-tcmu STDERR: ${tcmuStderr}`);
              console.error("Please consult the artifacts for more details");
              reject("overlaybd-tcmu exited");
            } else {
              resolve(void 0);
            }
          });
        });
        tcmuSubprocess = [cp, cpWait];
      } else {
        cpWait = Promise.resolve();
      }
      const testPromise = testFn({ brService, injector, runId });
      // Either the test finishes/crashes or overlaybd crashes/finishes
      await Promise.race([testPromise, cpWait]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Failed run id: ${runId}`);
      throw err;
    } finally {
      await injector.dispose();
      if (tcmuSubprocess !== void 0) {
        shouldTerminate = true;
        tcmuSubprocess[0].kill("SIGINT");
        await tcmuSubprocess[1];
      }
    }
  });
};

test.concurrent(
  "tcmuStorageId => lun mapping sanity check",
  provideInjector(
    async ({ brService }) => {
      // Stability test - the id doesn't change between releases
      expect(brService.tcmuIdToLUN("random-string")).toEqual("13322996231709573508");
      expect(brService.tcmuIdToLUN("raccoons")).toEqual("12634500512917172457");
      // 2**64 - 1 is not a fixed point, otherwise we will loop forever in that case
      expect(brService.tcmuIdToLUN("18446744073709551615")).toEqual("7702772950068300006");
    },
    { skipInit: true },
  ),
);

test.concurrent(
  "startFirecrackerInstance",
  provideInjector(async ({ brService, runId }) => {
    const im = await brService.loadImageFromRemoteRepo(testImages.test2, "AAAA");
    const im2 = await brService.loadImageFromRemoteRepo(testImages.test3, "BBBB");

    const c = await brService.createContainer(im, "AAAAAasdaasd");

    //const im2 = await brService.commitContainer(c, "VVVVVVV");

    console.log(await brService.expose(im, EXPOSE_METHOD.BLOCK_DEV));
    console.log(await brService.expose(im2, EXPOSE_METHOD.BLOCK_DEV));
    console.log(await brService.expose(im, EXPOSE_METHOD.BLOCK_DEV));
    console.log(await brService.expose(im, EXPOSE_METHOD.BLOCK_DEV));

    await sleep(20_000);

    //console.log(await brService.expose(im2, EXPOSE_METHOD.BLOCK_DEV));

    throw new Error("AAAA");
    console.log("Hello world");
    /*const fcService = injector.resolve(Token.FirecrackerService)(runId);
    let pid: number | null = null;

    try {
      pid = await fcService.startFirecrackerInstance();
      // we wait for a bit to make sure the instance does not exit
      await sleep(250);
      // check that the process is still running
      execCmd("ps", "-p", pid.toString());
    } finally {
      if (pid != null) {
        process.kill(pid);
      }
    }*/
  }),
);
