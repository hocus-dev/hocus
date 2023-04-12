import type { Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";
import { provideAppInjector, provideAppInjectorAndDb } from "~/test-utils";
import { TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { Token } from "~/token";

test.concurrent(
  "addGitRepository",
  provideAppInjectorAndDb(async ({ injector, db }) => {
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const gitService = injector.resolve(Token.GitService);
    const pair = await sshKeyService.createSshKeyPair(
      db,
      TESTS_PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    const repo = await db.$transaction((tdb) =>
      gitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id),
    );
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

test.concurrent(
  "updateConnectionStatus",
  provideAppInjectorAndDb(async ({ injector, db }) => {
    const gitService = injector.resolve(Token.GitService);

    const repo = await db.$transaction((tdb) => gitService.addGitRepository(tdb, TESTS_REPO_URL));
    const getConnStatus = (db: Prisma.Client) =>
      db.gitRepositoryConnectionStatus.findUniqueOrThrow({
        where: { gitRepositoryId: repo.id },
        include: {
          errors: {
            orderBy: { createdAt: "desc" },
          },
        },
      });
    let connectionStatus = await getConnStatus(db);
    expect(connectionStatus.lastSuccessfulConnectionAt).toBeNull();
    await db.$transaction(async (tdb) => {
      await gitService.updateConnectionStatus(tdb, repo.id);
      connectionStatus = await getConnStatus(tdb);
      expect(connectionStatus.lastSuccessfulConnectionAt).not.toBeNull();
      expect(connectionStatus.errors.length).toBe(0);
      const errorsCount = 5;
      for (let i = 0; i < errorsCount; i++) {
        await gitService.updateConnectionStatus(tdb, repo.id, "failed to fetch repo");
      }
      connectionStatus = await getConnStatus(tdb);
      expect(connectionStatus.errors.length).toBe(errorsCount);
      await gitService.updateConnectionStatus(tdb, repo.id);
      connectionStatus = await getConnStatus(tdb);
      expect(connectionStatus.errors.length).toBe(0);
    });
  }),
);
