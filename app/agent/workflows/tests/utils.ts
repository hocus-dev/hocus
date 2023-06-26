import type { GitRepository, Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";

import type { AgentInjector } from "~/agent/agent-injector";
import { TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { Token } from "~/token";

export const createTestRepo = async (
  db: Prisma.NonTransactionClient,
  injector: AgentInjector,
): Promise<GitRepository> => {
  const gitService = injector.resolve(Token.GitService);
  const sshKeyService = injector.resolve(Token.SshKeyService);

  const pair = await sshKeyService.createSshKeyPair(
    db,
    TESTS_PRIVATE_SSH_KEY,
    SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
  );
  const repo = await db.$transaction((tdb) =>
    gitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id),
  );
  return repo;
};
