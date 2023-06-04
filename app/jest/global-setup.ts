import { TestStateManager } from "~/test-state-manager/client";

export default async (_globalConfig: any, _projectConfig: any) => {
  const stateManager = new TestStateManager("/tmp/test-state-manager.sock");
  await stateManager.connect();
  (globalThis as any).stateManager = stateManager;
};
