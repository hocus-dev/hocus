import type { PrebuildEvent } from "@prisma/client";

import type { CreateActivity } from "./types";
import { withActivityHeartbeat } from "./utils";

import { Token } from "~/token";

export type CreatePrebuildEventActivity = (args: {
  projectId: bigint;
  gitObjectId: bigint;
  externalId: string;
}) => Promise<PrebuildEvent>;
export const createPrebuildEvent: CreateActivity<CreatePrebuildEventActivity> = ({
  injector,
  db,
}) =>
  withActivityHeartbeat({ intervalMs: 1000 }, async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    return await db.$transaction((tdb) => prebuildService.createPrebuildEvent(tdb, args));
  });
