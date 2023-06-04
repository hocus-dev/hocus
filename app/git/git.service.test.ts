import type { Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";

import { createAppInjector } from "~/app-injector.server";
import { TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";

test.concurrent(
  "addGitRepository",
  new TestEnvironmentBuilder(createAppInjector)
    .withTestLogging()
    .withTestDb()
    .run(async ({ injector, db }) => {
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
  new TestEnvironmentBuilder(createAppInjector).withTestLogging().run(async ({ injector }) => {
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
  "updateConnectionStatus and getConnectionStatus",
  new TestEnvironmentBuilder(createAppInjector)
    .withTestLogging()
    .withTestDb()
    .run(async ({ injector, db }) => {
      const gitService = injector.resolve(Token.GitService);

      const [repo, repo2] = await db.$transaction(async (tdb) => {
        const repo = gitService.addGitRepository(tdb, TESTS_REPO_URL);
        const repo2 = gitService.addGitRepository(tdb, "git@github.com:hocus-dev/tests2.git");
        return Promise.all([repo, repo2]);
      });
      const getConnStatus = (db: Prisma.Client, repoId?: bigint) =>
        db.gitRepositoryConnectionStatus.findUniqueOrThrow({
          where: { gitRepositoryId: repoId ?? repo.id },
          include: {
            errors: {
              orderBy: { createdAt: "desc" },
            },
          },
        });
      let connectionStatus = await getConnStatus(db);
      expect(connectionStatus.lastSuccessfulConnectionAt).toBeNull();
      let processedStatus = await gitService.getConnectionStatus(db, repo.id);
      expect(processedStatus).toStrictEqual({ status: "disconnected" });

      const errorMsg = "failed to fetch repo";
      await db.$transaction(async (tdb) => {
        // verify that we can update connection status
        await gitService.updateConnectionStatus(tdb, repo.id);
        connectionStatus = await getConnStatus(tdb);
        expect(connectionStatus.lastSuccessfulConnectionAt).not.toBeNull();
        processedStatus = await gitService.getConnectionStatus(tdb, repo.id);
        expect(processedStatus).toStrictEqual({
          status: "connected",
          lastConnectedAt: connectionStatus.lastSuccessfulConnectionAt?.getTime(),
        });

        const errorsCount = 5;
        for (const repoId of [repo.id, repo2.id]) {
          let connStatus = await getConnStatus(db, repoId);

          // verify that we can store connection errors
          expect(connStatus.errors.length).toBe(0);
          for (let i = 0; i < errorsCount; i++) {
            await gitService.updateConnectionStatus(tdb, repoId, errorMsg);
          }
          connStatus = await getConnStatus(tdb, repoId);
          expect(connStatus.errors.length).toBe(errorsCount);

          processedStatus = await gitService.getConnectionStatus(tdb, repoId);
          expect(processedStatus).toStrictEqual({
            status: "disconnected",
            error: { message: errorMsg, occurredAt: connStatus.errors[0].createdAt?.getTime() },
          });
        }

        // verify that we don't store more than maxErrorsCount errors
        const maxErrorsCount = 3;
        gitService["maxConnectionErrors"] = maxErrorsCount;
        await gitService.updateConnectionStatus(tdb, repo.id, errorMsg);
        connectionStatus = await getConnStatus(tdb);
        expect(connectionStatus.errors.length).toBe(maxErrorsCount);

        // verify that we can clear connection errors
        await gitService.updateConnectionStatus(tdb, repo.id);
        connectionStatus = await getConnStatus(tdb);
        expect(connectionStatus.errors.length).toBe(0);

        // verify that other repo's status is not affected
        const connectionStatus2 = await getConnStatus(tdb, repo2.id);
        expect(connectionStatus2.errors.length).toBe(errorsCount);
        expect(connectionStatus2.lastSuccessfulConnectionAt).toBeNull();
      });
    }),
);
