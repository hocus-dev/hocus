import type { Prisma } from "@prisma/client";

import type { UserService } from "./user.service.server";

import { createAppInjector } from "~/app-injector.server";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";

type Args = {
  db: Prisma.NonTransactionClient;
  userService: UserService;
};

const provideUserService = (testFn: (args: Args) => Promise<void>): (() => Promise<void>) => {
  return provideDb(async (db) => {
    const userService = createAppInjector().resolve(Token.UserService);
    await testFn({ db, userService });
  });
};

test.concurrent(
  "getOrCreateUser",
  provideUserService(async ({ db, userService }) => {
    const externalId = "123";

    const user = await userService.getOrCreateUser(db, { externalId, gitEmail: "dev@example.com" });
    const userWithExtras = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { gitConfig: true },
    });
    expect(user.externalId).toEqual(externalId);
    expect(userWithExtras.gitConfig.gitEmail).toEqual("dev@example.com");
    expect(userWithExtras.gitConfig.gitUsername).toEqual("dev");
  }),
);
