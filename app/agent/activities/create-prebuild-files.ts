import type { PrebuildEventFiles } from "@prisma/client";
import { Token } from "~/token";

import type { CreateActivity } from "./types";

export type CreatePrebuildFilesActivity = (args: {
  prebuildEventId: bigint;
  sourceProjectDrivePath: string;
}) => Promise<PrebuildEventFiles>;
export const createPrebuildFiles: CreateActivity<CreatePrebuildFilesActivity> =
  ({ injector, db }) =>
  async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);

    const agentInstance = await db.$transaction(async (tdb) =>
      agentUtilService.getOrCreateSoloAgentInstance(tdb),
    );
    return await prebuildService.createPrebuildEventFiles(db, {
      ...args,
      agentInstanceId: agentInstance.id,
    });
  };
