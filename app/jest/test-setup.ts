// eslint-disable-next-line n/prefer-global/console
import console from "console";

import { TestStateManager } from "~/test-state-manager/client";
// https://github.com/jestjs/jest/issues/10322#issuecomment-1304375267
global.console = console;

beforeAll(async () => {
  let testStorageDir = process.env.TEST_STORAGE_DIR;
  if (testStorageDir === void 0) {
    // eslint-disable-next-line no-console
    throw new Error("Please provide TEST_STORAGE_DIR");
  }
  const stateManager = new TestStateManager(testStorageDir);
  await stateManager.connect();
  stateManager.on("error", (err: Error) => {
    // eslint-disable-next-line no-console
    console.error("State manager terminated due to error", err);
    process.kill(process.pid, "SIGINT");
  });
  stateManager.on("close", () => {
    // eslint-disable-next-line no-console
    console.error("Connection to state manager terminated");
    process.kill(process.pid, "SIGINT");
  });
  (globalThis as any).stateManager = stateManager;
});

afterAll(async () => {
  await (globalThis as any).stateManager.close();
});