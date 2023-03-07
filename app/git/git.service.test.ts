import { SshKeyPairType } from "@prisma/client";
import { provideAppInjector, provideAppInjectorAndDb } from "~/test-utils";
import { PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { Token } from "~/token";

test.concurrent(
  "addGitRepository",
  provideAppInjectorAndDb(async ({ injector, db }) => {
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const gitService = injector.resolve(Token.GitService);
    const pair = await sshKeyService.createSshKeyPair(
      db,
      PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    const repo = await gitService.addGitRepository(db, TESTS_REPO_URL, pair.id);
    expect(repo.url).toEqual(TESTS_REPO_URL);
    expect(repo.sshKeyPairId).toEqual(pair.id);
  }),
);

test.concurrent(
  "isGitSshUrl",
  provideAppInjector(async ({ injector }) => {
    const gitService = injector.resolve(Token.GitService);

    expect(
      gitService.isGitSshUrl(
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKiORinAjmVtn01GMUQ9TegSL4Wrz4dorS18OUOFv1YL hocus",
      ),
    ).toBe(false);
    expect(gitService.isGitSshUrl(TESTS_REPO_URL)).toBe(true);
  }),
);
