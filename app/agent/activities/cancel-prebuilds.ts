import type { CreateActivity } from "./types";

import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

export type CancelPrebuildsActivity = (
  prebuildEventIds: bigint[],
  errorMessage?: string,
) => Promise<void>;
export const cancelPrebuilds: CreateActivity<CancelPrebuildsActivity> =
  ({ injector, db }) =>
  async (prebuildEventIds, errorMessage) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    await waitForPromises(
      prebuildEventIds.map((prebuildEventId) =>
        db.$transaction((tdb) =>
          prebuildService.cleanupDbAfterPrebuildError(tdb, prebuildEventId, errorMessage),
        ),
      ),
    );
  };
