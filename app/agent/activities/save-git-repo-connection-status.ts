import { Token } from "~/token";

import type { CreateActivity } from "./types";

export type SaveGitRepoConnectionStatusActivity = (args: {
  gitRepositoryId: bigint;
  error?: string;
}) => Promise<void>;
export const saveGitRepoConnectionStatus: CreateActivity<SaveGitRepoConnectionStatusActivity> =
  ({ injector, db }) =>
  async (args) => {
    const gitService = injector.resolve(Token.GitService);
    await db.$transaction((tdb) =>
      gitService.updateConnectionStatus(tdb, args.gitRepositoryId, args.error),
    );
  };
