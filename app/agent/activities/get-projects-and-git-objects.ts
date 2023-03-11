import type { Project, GitObject } from "@prisma/client";

import type { CreateActivity } from "./types";

export type GetProjectsAndGitObjectsActivity = (
  projectIds: bigint[],
  gitObjectIds: bigint[],
) => Promise<{ projects: Project[]; gitObjects: GitObject[] }>;
export const getProjectsAndGitObjects: CreateActivity<GetProjectsAndGitObjectsActivity> =
  ({ db }) =>
  async (projectIds, gitObjectIds) => {
    const projects = await db.project.findMany({
      where: { id: { in: projectIds } },
    });
    if (projects.length !== projectIds.length) {
      throw new Error("Some projects were not found");
    }
    const gitObjects = await db.gitObject.findMany({
      where: { id: { in: gitObjectIds } },
    });
    if (gitObjects.length !== gitObjectIds.length) {
      throw new Error("Some git objects were not found");
    }
    return { projects, gitObjects };
  };
