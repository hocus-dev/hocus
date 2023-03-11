import { Token } from "~/token";

import type { UpdateBranchesResult } from "../git/git.service";

import type { CreateActivity } from "./types";

export type UpdateGitBranchesAndObjectsActivity = (
  gitRepositoryId: bigint,
) => Promise<UpdateBranchesResult>;
export const updateGitBranchesAndObjects: CreateActivity<UpdateGitBranchesAndObjectsActivity> =
  ({ injector, db }) =>
  async (gitRepositoryId) => {
    const gitService = injector.resolve(Token.AgentGitService);
    return await gitService.updateBranches(db, gitRepositoryId);
  };
