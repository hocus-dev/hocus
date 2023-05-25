import type { GitRepository } from "@prisma/client";

import type { CreateActivity } from "./types";

export type GetProjectsRepositoryActivity = (projectId: bigint) => Promise<GitRepository>;
export const getProjectsRepository: CreateActivity<GetProjectsRepositoryActivity> =
  ({ db }) =>
  async (prebuildEventId) => {
    return await db.project
      .findUniqueOrThrow({
        where: {
          id: prebuildEventId,
        },
        include: {
          gitRepository: true,
        },
      })
      .then((p) => p.gitRepository);
  };
