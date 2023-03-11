import type { Project } from "@prisma/client";

import type { CreateActivity } from "./types";

export type GetRepositoryProjectsActivity = (gitRepositoryId: bigint) => Promise<Project[]>;
export const getRepositoryProjects: CreateActivity<GetRepositoryProjectsActivity> =
  ({ db }) =>
  async (gitRepositoryId) => {
    return await db.project.findMany({
      where: { gitRepositoryId },
      orderBy: { id: "asc" },
    });
  };
