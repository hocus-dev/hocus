import { TestStateManager } from "~/test-state-manager/client";

export default async (_globalConfig: any, _projectConfig: any) => {
  let socketPath = process.env.TEST_STATE_MANAGER_SOCK;
  if (socketPath === void 0) {
    // eslint-disable-next-line no-console
    throw new Error("Please provide TEST_STATE_MANAGER_SOCK");
  }
  const stateManager = new TestStateManager(socketPath);
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
};
