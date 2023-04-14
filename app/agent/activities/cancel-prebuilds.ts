import type { CreateActivity } from "./types";

import { Token } from "~/token";

export type CancelPrebuildsActivity = (prebuildEventIds: bigint[]) => Promise<void>;
export const cancelPrebuilds: CreateActivity<CancelPrebuildsActivity> =
  ({ injector, db }) =>
  async (prebuildEventIds) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    await db.$transaction((tdb) => prebuildService.cancelPrebuilds(tdb, prebuildEventIds));
  };
