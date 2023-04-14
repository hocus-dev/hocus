import type { PrebuildEventStatus } from "@prisma/client";

import type { CreateActivity } from "./types";

import { Token } from "~/token";

export type ChangePrebuildEventStatusActivity = (
  prebuildEventId: bigint,
  status: PrebuildEventStatus,
) => Promise<void>;
export const changePrebuildEventStatus: CreateActivity<ChangePrebuildEventStatusActivity> =
  ({ injector, db }) =>
  async (prebuildEventId, status) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    await db.$transaction((tdb) =>
      prebuildService.changePrebuildEventStatus(tdb, prebuildEventId, status),
    );
  };
