import type { PrebuildEvent } from "@prisma/client";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

import type { CreateActivity } from "./types";

export type CreatePrebuildEventsActivity = (
  args: {
    projectId: bigint;
    gitObjectId: bigint;
    gitBranchIds: bigint[];
    buildfsEventId: bigint | null;
    sourceProjectDrivePath: string;
    tasks: { command: string; cwd: string }[];
    workspaceTasks: { command: string; commandShell: string }[];
  }[],
) => Promise<PrebuildEvent[]>;

export const createPrebuildEvents: CreateActivity<CreatePrebuildEventsActivity> =
  ({ injector, db }) =>
  async (args): Promise<PrebuildEvent[]> => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);

    return await db.$transaction(async (tdb) => {
      const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);
      return await waitForPromises(
        args.map((arg) =>
          prebuildService.preparePrebuild(tdb, { ...arg, agentInstanceId: agentInstance.id }),
        ),
      );
    });
  };
