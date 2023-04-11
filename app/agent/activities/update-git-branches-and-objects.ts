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
    const perfService = injector.resolve(Token.PerfService);

    perfService.log("updateGitBranchesAndObjects", "start", gitRepositoryId);
    const result = await gitService.updateBranches(db, gitRepositoryId);
    perfService.log("updateGitBranchesAndObjects", "end", gitRepositoryId);
    return result;
  };
