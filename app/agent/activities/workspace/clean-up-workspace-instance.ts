import { withActivityHeartbeat } from "../utils";

import type { CreateActivity } from "~/agent/activities/types";
import { BlockRegistryService } from "~/agent/block-registry/registry.service";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

export type CleanUpWorkspaceInstanceLocalActivity = (args: {
  workspaceId: bigint;
  /** Used if there is no workspace instance associated with the workspace */
  vmInstanceId?: string;
}) => Promise<void>;
export const cleanUpWorkspaceInstanceLocal: CreateActivity<
  CleanUpWorkspaceInstanceLocalActivity
> = ({ injector, db }) =>
  withActivityHeartbeat({ intervalMs: 5000 }, async (args) => {
    const logger = injector.resolve(Token.Logger);
    const brService = injector.resolve(Token.BlockRegistryService);
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { id: args.workspaceId },
      include: {
        rootFsImage: true,
        projectImage: true,
        activeInstance: true,
      },
    });
    const vmInstanceId = workspace.activeInstance?.runtimeInstanceId ?? args.vmInstanceId;
    if (vmInstanceId == null) {
      logger.warn(
        `No VM instance id found for workspace with id ${workspace.id}. Skipping local cleanup.`,
      );
      return;
    }
    const runtime = injector.resolve(Token.QemuService)(vmInstanceId);
    await runtime.cleanup();
    await waitForPromises(
      [workspace.rootFsImage.tag, workspace.projectImage.tag]
        .map((tag) => BlockRegistryService.genContainerId(tag))
        .map((contentId) => brService.hide(contentId)),
    );
  });

export type CleanUpWorkspaceInstanceDbActivity = (args: {
  workspaceId: bigint;
  latestError: string;
}) => Promise<void>;
export const cleanUpWorkspaceInstanceDb: CreateActivity<CleanUpWorkspaceInstanceDbActivity> = ({
  injector,
  db,
}) =>
  withActivityHeartbeat({ intervalMs: 5000 }, async (args) => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);
    await db.$transaction((tdb) =>
      workspaceAgentService.cleanUpWorkspaceAfterErrorDb(tdb, args.workspaceId, args.latestError),
    );
  });
