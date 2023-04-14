import { WorkspaceStatus } from "@prisma/client";

import type { CreateActivity } from "./types";

import { Token } from "~/token";

export type DeleteWorkspaceActivity = (workspaceId: bigint) => Promise<void>;
export const deleteWorkspace: CreateActivity<DeleteWorkspaceActivity> =
  ({ injector, db }) =>
  async (workspaceId) => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);
    await db.$transaction((tdb) =>
      workspaceAgentService.markWorkspaceAs(
        tdb,
        workspaceId,
        WorkspaceStatus.WORKSPACE_STATUS_PENDING_DELETE,
      ),
    );
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        rootFsFile: true,
        projectFile: true,
      },
    });
    await workspaceAgentService.deleteWorkspaceFilesFromDisk({
      rootFsFilePath: workspace.rootFsFile.path,
      projectFilePath: workspace.projectFile.path,
    });
    await db.$transaction((tdb) => workspaceAgentService.deleteWorkspaceFromDb(tdb, workspaceId));
  };
