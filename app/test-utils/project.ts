import type { GitRepository, Prisma, Project } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";

import { TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "./constants";

import type { GitService } from "~/git/git.service";
import type { ProjectService } from "~/project/project.service";
import type { SshKeyService } from "~/ssh-key/ssh-key.service";
import { Token } from "~/token";

export const createExampleRepositoryAndProject = async (args: {
  tdb: Prisma.TransactionClient;
  injector: any;
}): Promise<Project & { gitRepository: GitRepository }> => {
  const { tdb, injector } = args;
  const projectService: ProjectService = injector.resolve(Token.ProjectService);
  const gitService: GitService = injector.resolve(Token.GitService);
  const sshKeyService: SshKeyService = injector.resolve(Token.SshKeyService);
  const pair = await sshKeyService.createSshKeyPair(
    tdb,
    TESTS_PRIVATE_SSH_KEY,
    SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
  );
  const repo = await gitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id);
  const project = await projectService.createProject(tdb, {
    gitRepositoryId: repo.id,
    rootDirectoryPath: "/",
    name: "test",
  });
  return {
    ...project,
    gitRepository: repo,
  };
};
