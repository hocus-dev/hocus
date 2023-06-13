import type { CreateActivity } from "./types";
import { runActivityHeartbeat } from "./utils";

import { Token } from "~/token";

export type CreatePrebuildImagesActivity = (args: {
  prebuildEventId: bigint;
  checkoutOutputId: string;
}) => Promise<PrebuildEventImages>;
export const createPrebuildImages: CreateActivity<CreatePrebuildImagesActivity> =
  ({ injector, db }) =>
  async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const perfService = injector.resolve(Token.PerfService);

    perfService.log("createPrebuildFiles", "start", args);
    const result = await runActivityHeartbeat({}, async () => {
      await db.$transaction(async (tdb) => {
        const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);
        return prebuildService.createPrebuildEventImagesInDb(tdb, {
          ...args,
          agentInstanceId: agentInstance.id,
        });
      });
    });
    perfService.log("createPrebuildFiles", "end", args);
    return result;
  };
