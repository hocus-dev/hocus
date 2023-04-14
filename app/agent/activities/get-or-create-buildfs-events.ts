import { v4 as uuidv4 } from "uuid";

import type { GetOrCreateBuildfsEventsReturnType } from "../buildfs.service";

import type { CreateActivity } from "./types";

import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

export type GetOrCreateBuildfsEventsActivity = (
  args: {
    contextPath: string;
    dockerfilePath: string;
    cacheHash: string | null;
    outputFilePath: string;
    projectFilePath: string;
    projectId: bigint;
  }[],
) => Promise<GetOrCreateBuildfsEventsReturnType[]>;
export const getOrCreateBuildfsEvents: CreateActivity<GetOrCreateBuildfsEventsActivity> =
  ({ injector, db }) =>
  async (args) => {
    const buildfsService = injector.resolve(Token.BuildfsService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const agentInstance = await db.$transaction((tdb) =>
      agentUtilService.getOrCreateSoloAgentInstance(tdb),
    );
    return await db.$transaction((tdb) =>
      waitForPromises(
        args.map((arg) =>
          buildfsService.getOrCreateBuildfsEvent(tdb, {
            ...arg,
            cacheHash: arg.cacheHash ?? `CACHE_HASH_NULL_${uuidv4()}`,
            agentInstanceId: agentInstance.id,
          }),
        ),
      ),
    );
  };
