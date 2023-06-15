import { WorkspaceStatus } from "@prisma/client";

import type { CreateActivity } from "../types";

import { BlockRegistryService } from "~/agent/block-registry/registry.service";
import { Token } from "~/token";
import { unwrap, waitForPromises } from "~/utils.shared";

export type StopWorkspaceActivity = (workspaceId: bigint) => Promise<void>;
export const stopWorkspace: CreateActivity<StopWorkspaceActivity> =
  ({ injector, db }) =>
  async (workspaceId) => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);
    const brService = injector.resolve(Token.BlockRegistryService);

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
        rootFsImage: true,
        projectImage: true,
        activeInstance: true,
      },
    });
    const instance = unwrap(workspace.activeInstance);
    const runtime = injector.resolve(Token.QemuService)(instance.runtimeInstanceId);

    await runtime.cleanup();
    await waitForPromises(
      [workspace.rootFsImage.tag, workspace.projectImage.tag]
        .map((tag) => BlockRegistryService.genContainerId(tag))
        .map((contentId) => brService.hide(contentId)),
    );

    await db.$transaction((tdb) =>
      workspaceAgentService.removeWorkspaceInstanceFromDb(tdb, workspaceId),
    );
  };
