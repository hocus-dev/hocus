import type { PrebuildEventImages } from "@prisma/client";

import type { CreateActivity } from "./types";
import { withActivityHeartbeat } from "./utils";

import { Token } from "~/token";
import { sha256 } from "~/utils.server";

export type CreatePrebuildImagesActivity = (args: {
  prebuildEventId: bigint;
}) => Promise<PrebuildEventImages>;
export const createPrebuildImages: CreateActivity<CreatePrebuildImagesActivity> = ({
  injector,
  db,
}) =>
  withActivityHeartbeat({ intervalMs: 5000 }, async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const perfService = injector.resolve(Token.PerfService);

    perfService.log("createPrebuildFiles", "start", args);
    const result = await db.$transaction(async (tdb) => {
      const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);
      const { externalId } = await tdb.prebuildEvent.findUniqueOrThrow({
        where: {
          id: args.prebuildEventId,
        },
        select: {
          externalId: true,
        },
      });
      return prebuildService.createPrebuildEventImagesInDb(tdb, {
        outputProjectImageTag: sha256(externalId + "project"),
        outputFsImageTag: sha256(externalId + "fs"),
        prebuildEventId: args.prebuildEventId,
        agentInstanceId: agentInstance.id,
      });
    });
    perfService.log("createPrebuildFiles", "end", args);
    return result;
  });
