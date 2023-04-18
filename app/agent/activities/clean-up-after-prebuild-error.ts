import type { CreateActivity } from "./types";

import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

export type CleanUpAfterPrebuildErrorActivity = (args: {
  prebuildEventIds: bigint[];
  errorMessage: string;
}) => Promise<void>;
export const cleanUpAfterPrebuildError: CreateActivity<CleanUpAfterPrebuildErrorActivity> =
  ({ injector, db }) =>
  async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    await waitForPromises(
      args.prebuildEventIds.map((prebuildEventId) =>
        db.$transaction((tdb) =>
          // TODO: clean up local files too once we rewrite how storage is handled in general
          prebuildService.cleanupDbAfterPrebuildError(tdb, prebuildEventId, args.errorMessage),
        ),
      ),
    );
  };
