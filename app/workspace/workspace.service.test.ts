import { WorkspaceService } from "./workspace.service";

import { config } from "~/config";

test.concurrent("name generation works", async () => {
  const service = new WorkspaceService(config);
  expect(service.generateWorkspaceName()).toBeDefined();
});
