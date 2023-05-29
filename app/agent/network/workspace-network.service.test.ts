import fs from "fs/promises";

import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "../agent-injector";

import { MAXIMUM_IP_ID, MINIMUM_IP_ID } from "./storage/constants";
import type { IpBlockId } from "./workspace-network.service";

import { Scope } from "~/di/injector.server";
import { printErrors } from "~/test-utils";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

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
  "getIpsFromIpBlockId",
  provideInjector(async ({ injector }) => {
    const networkService = injector.resolve(Token.WorkspaceNetworkService);
    expect(networkService["getIpsFromIpBlockId"](MINIMUM_IP_ID as IpBlockId)).toMatchObject({
      tapIfIp: "10.231.0.9",
      vmIp: "10.231.0.10",
    });
    expect(networkService["getIpsFromIpBlockId"](MAXIMUM_IP_ID as IpBlockId)).toMatchObject({
      tapIfIp: "10.231.255.253",
      vmIp: "10.231.255.254",
    });
  }),
);

test.concurrent(
  "allocateIpBlock",
  provideInjector(async ({ injector, runId }) => {
    const networkService = injector.resolve(Token.WorkspaceNetworkService);
    const storageService = injector.resolve(Token.StorageService);
    const filePath = `/tmp/hocus-network-storage-test-${runId}.yaml`;
    storageService["lowLevelStorageService"].getPathToStorage = () => filePath;
    try {
      const ipBlockIds = await waitForPromises(
        Array.from({ length: 15 }).map(() => networkService.allocateIpBlock()),
      );
      expect(new Set(ipBlockIds).size).toEqual(ipBlockIds.length);
    } finally {
      await fs.unlink(filePath);
    }
  }),
);
