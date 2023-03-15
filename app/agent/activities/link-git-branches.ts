import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

import type { CreateActivity } from "./types";

export type LinkGitBranchesActivity = (
  args: {
    prebuildEventId: bigint;
    gitBranchIds: bigint[];
  }[],
) => Promise<void>;
export const linkGitBranches: CreateActivity<LinkGitBranchesActivity> =
  ({ injector, db }) =>
  async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    await db.$transaction((tdb) =>
      waitForPromises(
        args.map((arg) =>
          prebuildService.upsertGitBranchesToPrebuildEvent(
            tdb,
            arg.prebuildEventId,
            arg.gitBranchIds,
          ),
        ),
      ),
    );
  };
