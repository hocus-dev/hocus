import { SshKeyPairType } from "@prisma/client";
import sshpk from "sshpk";
import { provideAppInjectorAndDb } from "~/test-utils";
import { PRIVATE_SSH_KEY, PUBLIC_SSH_KEY } from "~/test-utils/constants";
import { Token } from "~/token";
import { createTestUser } from "~/user/test-utils";

test.concurrent(
  "createSshKeyPair, generateSshKeyPair",
  provideAppInjectorAndDb(async ({ injector, db }) => {
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const pair = await sshKeyService.createSshKeyPair(
      db,
      PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    expect(pair.publicKey).toEqual(PUBLIC_SSH_KEY);
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
  "getOrCreateServerControlledSshKeyPair",
  provideAppInjectorAndDb(async ({ injector, db }) => {
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const tasks = new Array(25)
      .fill(0)
      .map(() =>
        db.$transaction((tdb) => sshKeyService.getOrCreateServerControlledSshKeyPair(tdb)),
      );
    const keyPairs = await Promise.all(tasks);
    const keyPairId = keyPairs[0].id;
    expect(keyPairs.every((kp) => kp.id === keyPairId)).toBe(true);
  }),
);

test.concurrent(
  "createPublicSshKeyForUser",
  provideAppInjectorAndDb(async ({ injector, db }) => {
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const testUser = await createTestUser(db);
    await db.$transaction(async (tdb) => {
      const sshKey = await sshKeyService.createPublicSshKeyForUser(
        tdb,
        testUser.id,
        PUBLIC_SSH_KEY,
      );
      expect(sshKey.publicKey).toEqual(PUBLIC_SSH_KEY);
    });
    try {
      await db.$transaction(async (tdb) => {
        await sshKeyService.createPublicSshKeyForUser(tdb, testUser.id, "xd");
        throw new Error("unreachable");
      });
    } catch (err) {
      if (!(err instanceof sshpk.KeyParseError)) {
        throw err;
      }
    }
  }),
);
