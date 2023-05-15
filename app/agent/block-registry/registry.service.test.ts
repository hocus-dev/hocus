import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "../agent-injector";

import testImages from "./test-data/test_images.json";

import { Scope } from "~/di/injector.server";
import { printErrors } from "~/test-utils";
import { Token } from "~/token";
import { EXPOSE_METHOD } from "./registry.service";
import { ChildProcess, spawn } from "child_process";
import path from "path";
import { sleep } from "~/utils.shared";

const provideInjector = (
  testFn: (args: {
    injector: ReturnType<typeof createAgentInjector>;
    runId: string;
  }) => Promise<void>,
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
  return printErrors(async () => {
    try {
      await testFn({ injector, runId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Failed run id: ${runId}`);
      throw err;
    } finally {
      await injector.dispose();
    }
  });
};

test.concurrent(
  "startFirecrackerInstance",
  provideInjector(async ({ injector, runId }) => {
    const brService = injector.resolve(Token.BlockRegistryService);
    const config = injector.resolve(Token.Config);
    await brService.initializeRegistry();

    const im = await brService.loadImageFromRemoteRepo(testImages.test2, "AAAA");
    const a = spawn("/opt/overlaybd/bin/overlaybd-tcmu", [
      path.join(config.agent().blockRegistryRoot, "overlaybd.json"),
    ]);
    a.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });
    a.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });
    a.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
    });

    await sleep(3000);

    const c = await brService.createContainer(im, "AAAAAasdaasd");

    const im2 = await brService.commitContainer(c, "VVVVVVV");

    console.log(await brService.expose(im, EXPOSE_METHOD.BLOCK_DEV));

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
