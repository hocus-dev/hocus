import type { PrebuildEventStatus } from "@prisma/client";
import { Token } from "~/token";

import type { CreateActivity } from "./types";

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
