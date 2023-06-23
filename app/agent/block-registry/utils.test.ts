import { createAgentInjector } from "../agent-injector";

import { expectContent } from "./test-utils";
import { removeContentWithPrefix } from "./utils";

import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";

const testEnv = new TestEnvironmentBuilder(createAgentInjector)
  .withTestLogging()
  .withBlockRegistry();

test.concurrent(
  "removeContentWithPrefix",
  testEnv.run(async ({ brService }) => {
    const prefix = "test-prefix";
    const ct1 = await brService.createContainer(void 0, "1", { mkfs: true, sizeInGB: 64 });
    await brService.commitContainer(ct1, "2", { removeContainer: false });
    await brService.commitContainer(ct1, `${prefix}2`, { removeContainer: false });
    await brService.commitContainer(ct1, `${prefix}3`, { removeContainer: false });
    await brService.createContainer(void 0, "4", { mkfs: true, sizeInGB: 64 });
    await expectContent(brService, {
      numTotalContent: 5,
      prefix: {
        value: prefix,
        numPrefixedContent: 2,
      },
    });
    await removeContentWithPrefix(brService, prefix);
    await expectContent(brService, {
      numTotalContent: 3,
      prefix: {
        value: prefix,
        numPrefixedContent: 0,
      },
    });
  }),
);
