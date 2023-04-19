import { WorkspaceStatus } from "@prisma/client";

import type { CreateActivity } from "./types";

import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export type StopWorkspaceActivity = (workspaceId: bigint) => Promise<void>;
export const stopWorkspace: CreateActivity<StopWorkspaceActivity> =
  ({ injector, db }) =>
  async (workspaceId) => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);

    await db.$transaction((tdb) =>
      workspaceAgentService.markWorkspaceAs(
        tdb,
        workspaceId,
        WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP,
      ),
    );
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        activeInstance: true,
      },
    });
    const instance = unwrap(workspace.activeInstance);
    const firecrackerService = injector.resolve(Token.FirecrackerService)(
      instance.firecrackerInstanceId,
    );

    await firecrackerService.cleanup();

    await db.$transaction((tdb) =>
      workspaceAgentService.removeWorkspaceInstanceFromDb(tdb, workspaceId),
    );
  };
