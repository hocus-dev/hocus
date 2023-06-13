import type { Workspace } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";

import type { CreateActivity } from "../types";
import { withActivityHeartbeat } from "../utils";

import { BlockRegistryService } from "~/agent/block-registry/registry.service";
import { SOLO_AGENT_INSTANCE_ID } from "~/agent/constants";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export type CreateWorkspaceActivity = (args: {
  name: string;
  prebuildEventId: bigint;
  gitBranchId: bigint;
  userId: bigint;
  externalId: string;
}) => Promise<Workspace>;
export const createWorkspace: CreateActivity<CreateWorkspaceActivity> = ({ injector, db }) =>
  withActivityHeartbeat({ intervalMs: 5000 }, async (args) => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);

    const workspace = await db.$transaction(async (tdb) => {
      const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);

      return workspaceAgentService.createWorkspaceInDb(tdb, {
        externalId: args.externalId,
        gitBranchId: args.gitBranchId,
        name: args.name,
        prebuildEventId: args.prebuildEventId,
        userId: args.userId,
        agentInstanceId: agentInstance.id,
      });
    });

    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: {
        id: args.prebuildEventId,
      },
      include: {
        prebuildEventImages: {
          include: {
            agentInstance: true,
            projectImage: true,
            fsImage: true,
          },
        },
      },
    });
    const images = unwrap(
      prebuildEvent.prebuildEventImages.find(
        (im) => im.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    );
    await workspaceAgentService.createWorkspaceContainers({
      projectImageId: BlockRegistryService.genImageId(images.projectImage.tag),
      rootFsImageId: BlockRegistryService.genImageId(images.fsImage.tag),
      outputProjectImageTag: workspace.projectImage.tag,
      outputRootFsImageTag: workspace.rootFsImage.tag,
    });
    await db.workspace.update({
      where: {
        id: workspace.id,
      },
      data: {
        status: WorkspaceStatus.WORKSPACE_STATUS_STOPPED,
      },
    });

    return workspace;
  });
