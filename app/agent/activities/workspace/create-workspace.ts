import type { Workspace } from "@prisma/client";

import type { CreateActivity } from "../types";

import { Token } from "~/token";

export type CreateWorkspaceActivity = (args: {
  name: string;
  prebuildEventId: bigint;
  gitBranchId: bigint;
  userId: bigint;
  externalId: string;
}) => Promise<Workspace>;
export const createWorkspace: CreateActivity<CreateWorkspaceActivity> =
  ({ injector, db }) =>
  async (args) => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);

    const workspace = await db.$transaction(async (tdb): Promise<Workspace> => {
      const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);

      return await workspaceAgentService.createWorkspaceInDb(tdb, {
        externalId: args.externalId,
        gitBranchId: args.gitBranchId,
        name: args.name,
        prebuildEventId: args.prebuildEventId,
        userId: args.userId,
        agentInstanceId: agentInstance.id,
      });
    });

    await workspaceAgentService.createWorkspaceFiles(db, workspace.id);

    return workspace;
  };
