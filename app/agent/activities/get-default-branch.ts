import type { GitBranch } from "@prisma/client";

import type { CreateActivity } from "./types";

export type GetDefaultBranchActivity = (gitRepositoryId: bigint) => Promise<GitBranch | null>;
export const getDefaultBranch: CreateActivity<GetDefaultBranchActivity> =
  ({ db }) =>
  async (gitRepositoryId) => {
    const branches = await db.gitBranch.findMany({
      where: {
        gitRepositoryId,
        name: {
          in: ["refs/heads/main", "refs/heads/master"],
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    if (branches.length === 0) {
      return null;
    }
    return branches[0];
  };
