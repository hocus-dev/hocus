import type { Prisma, User, UserSSHPublicKey } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { TEST_USER_PUBLIC_SSH_KEY } from "./test-constants";

export const createTestUser = async (
  db: Prisma.Client,
): Promise<
  User & {
    sshPublicKeys: UserSSHPublicKey[];
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
    },
    include: {
      sshPublicKeys: true,
    },
  });
};
