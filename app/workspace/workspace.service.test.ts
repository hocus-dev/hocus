import { WorkspaceService } from "./workspace.service";

test.concurrent("name generation works", async () => {
  const service = new WorkspaceService();
  expect(service.generateWorkspaceName()).toBeDefined();
});
