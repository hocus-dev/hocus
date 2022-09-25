import type { PrismaClient } from "@prisma/client";
import { provideDb } from "~/test-utils/db.server";

import { UserService } from "./user.service.server";

type Args = {
  db: PrismaClient;
  userService: UserService;
};

const provideUserService = (testFn: (args: Args) => Promise<void>): (() => Promise<void>) => {
  return provideDb(async (db) => {
    const userService = new UserService();
    await testFn({ db, userService });
  });
};

test.concurrent(
  "getUser and getOrCreateUser",
  provideUserService(async ({ db, userService }) => {
    const externalId = "123";

    const user = await userService.getUser(db, externalId);
    expect(user).toBeNull();

    const createdUser = await userService.getOrCreateUser(db, externalId);
    expect(createdUser.externalId).toEqual(externalId);

    const user2 = await userService.getUser(db, externalId);
    expect(user2?.id).toEqual(createdUser.id);
  }),
);
