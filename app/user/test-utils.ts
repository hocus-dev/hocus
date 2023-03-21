import type { Prisma, User, UserGitConfig, UserSSHPublicKey } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { TEST_USER_PUBLIC_SSH_KEY } from "./test-constants";

export const createTestUser = async (
  db: Prisma.Client,
): Promise<
  User & {
    sshPublicKeys: UserSSHPublicKey[];
    gitConfig: UserGitConfig;
  }
> => {
  return await db.user.create({
    data: {
      externalId: uuidv4(),
      sshPublicKeys: {
        create: {
          name: "Test",
          publicKey: TEST_USER_PUBLIC_SSH_KEY,
        },
      },
      gitConfig: {
        create: {
          gitEmail: "dev@example.com",
          gitUsername: "dev",
        },
      },
    },
    include: {
      sshPublicKeys: true,
      gitConfig: true,
    },
  });
};
