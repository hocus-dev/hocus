import { config } from "~/config";

import { WorkspaceService } from "./workspace.service";

test.concurrent("name generation works", async () => {
  const service = new WorkspaceService(config);
  expect(service.generateWorkspaceName()).toBeDefined();
});
