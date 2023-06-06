import fs from "fs/promises";

import { createAgentInjector } from "../agent-injector";

import { MAXIMUM_IP_ID, MINIMUM_IP_ID } from "./storage/constants";
import type { IpBlockId } from "./workspace-network.service";

import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

const testEnv = new TestEnvironmentBuilder(createAgentInjector).withTestLogging();

test.concurrent(
  "getIpsFromIpBlockId",
  testEnv.run(async ({ injector }) => {
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
  testEnv.run(async ({ injector, runId }) => {
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
