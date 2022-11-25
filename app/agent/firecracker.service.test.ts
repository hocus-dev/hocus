import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";

import { createAgentInjector } from "./agent-injector";
import { MAXIMUM_IP_ID, MINIMUM_IP_ID } from "./storage/constants";
import { execCmd, sleep } from "./utils";

const provideInjector = (
  testFn: (args: {
    injector: ReturnType<typeof createAgentInjector>;
    runId: string;
  }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAgentInjector({
    [Token.Logger]: function () {
      return new DefaultLogger("ERROR");
    } as unknown as any,
  });
  const runId = uuidv4();
  return async () => {
    try {
      await testFn({ injector, runId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Failed run id: ${runId}`);
      throw err;
    } finally {
      await injector.dispose();
    }
  };
};

test.concurrent(
  "startFirecrackerInstance",
  provideInjector(async ({ injector, runId }) => {
    const fcService = injector.resolve(Token.FirecrackerService)(runId);
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
    }
  }),
);

test.concurrent(
  "getIpsFromIpId",
  provideInjector(async ({ injector }) => {
    const fcService = injector.resolve(Token.FirecrackerService)("xd");
    expect(fcService["getIpsFromIpId"](MINIMUM_IP_ID)).toMatchObject({
      tapDeviceIp: "10.231.0.9",
      vmIp: "10.231.0.10",
    });
    expect(fcService["getIpsFromIpId"](MAXIMUM_IP_ID)).toMatchObject({
      tapDeviceIp: "10.231.255.253",
      vmIp: "10.231.255.254",
    });
  }),
);
