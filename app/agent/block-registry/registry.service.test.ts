import { DefaultLogger } from "@temporalio/worker";
import { Scope } from "~/di/injector.server";
import { printErrors } from "~/test-utils";
import { Token } from "~/token";
import { createAgentInjector } from "../agent-injector";
import { v4 as uuidv4 } from "uuid";

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
