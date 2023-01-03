import type { Prisma, Project } from "@prisma/client";

export class ProjectService {
  async createProject(
    db: Prisma.TransactionClient,
    args: {
      gitRepositoryId: bigint;
      rootDirectoryPath: string;
      name: string;
    },
  ): Promise<Project> {
    const environmentVariableSet = await db.environmentVariableSet.create({ data: {} });
    return await db.project.create({
      data: {
        gitRepositoryId: args.gitRepositoryId,
        rootDirectoryPath: args.rootDirectoryPath,
        environmentVariableSetId: environmentVariableSet.id,
        name: args.name,
      },
    });
  }
}
