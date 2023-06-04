import { SshKeyPairType } from "@prisma/client";
import sshpk from "sshpk";

import { createAppInjector } from "~/app-injector.server";
import { TESTS_PRIVATE_SSH_KEY, TESTS_PUBLIC_SSH_KEY } from "~/test-utils/constants";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { createTestUser } from "~/user/test-utils";

test.concurrent(
  "createSshKeyPair, generateSshKeyPair",
  new TestEnvironmentBuilder(createAppInjector)
    .withTestLogging()
    .withTestDb()
    .run(async ({ injector, db }) => {
      const sshKeyService = injector.resolve(Token.SshKeyService);
      const pair = await sshKeyService.createSshKeyPair(
        db,
        TESTS_PRIVATE_SSH_KEY,
        SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
      );
      expect(pair.privateKey).toEqual(TESTS_PRIVATE_SSH_KEY);
      expect(pair.publicKey).toEqual(TESTS_PUBLIC_SSH_KEY);
      expect(pair.type).toEqual(SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED);

      const pair2 = await sshKeyService.generateSshKeyPair(
        db,
        SshKeyPairType.SSH_KEY_PAIR_TYPE_USER_SUPPLIED,
      );
      expect(pair2.publicKey).toBeDefined();
      expect(pair2.privateKey).toBeDefined();
      expect(pair2.type).toEqual(SshKeyPairType.SSH_KEY_PAIR_TYPE_USER_SUPPLIED);
    }),
);

test.concurrent(
  "createPublicSshKeyForUser",
  new TestEnvironmentBuilder(createAppInjector)
    .withTestLogging()
    .withTestDb()
    .run(async ({ injector, db }) => {
      const sshKeyService = injector.resolve(Token.SshKeyService);
      const testUser = await createTestUser(db);
      await db.$transaction(async (tdb) => {
        const sshKey = await sshKeyService.createPublicSshKeyForUser(
          tdb,
          testUser.id,
          TESTS_PUBLIC_SSH_KEY,
          "xd",
        );
        expect(sshKey.publicKey).toEqual(TESTS_PUBLIC_SSH_KEY);
      });
      try {
        await db.$transaction(async (tdb) => {
          await sshKeyService.createPublicSshKeyForUser(tdb, testUser.id, "xd", "xd");
          throw new Error("unreachable");
        });
      } catch (err) {
        if (!(err instanceof sshpk.KeyParseError)) {
          throw err;
        }
      }
    }),
);
