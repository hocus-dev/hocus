import type { Project, GitRepository } from "@prisma/client";
import { Token } from "~/token";

import type { CreateActivity } from "./types";

export type AddProjectAndRepositoryActivity = (args: {
  gitRepositoryUrl: string;
  projectName: string;
  projectWorkspaceRoot: string;
  sshKeyPairId?: bigint;
}) => Promise<{
  project: Project;
  gitRepository: GitRepository;
  gitRepositoryCreated: boolean;
}>;
export const addProjectAndRepository: CreateActivity<AddProjectAndRepositoryActivity> =
  ({ injector, db }) =>
  async (args) => {
    const gitService = injector.resolve(Token.GitService);
    const projectService = injector.resolve(Token.ProjectService);
    return await db.$transaction(async (tdb) => {
      const { gitRepository, wasCreated } = await gitService.addGitRepositoryIfNotExists(
        tdb,
        args.gitRepositoryUrl,
        args.sshKeyPairId,
      );
      const project = await projectService.createProject(tdb, {
        gitRepositoryId: gitRepository.id,
        name: args.projectName,
        rootDirectoryPath: args.projectWorkspaceRoot,
      });
      return { project, gitRepository, gitRepositoryCreated: wasCreated };
    });
  };
