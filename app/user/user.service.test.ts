import type { Prisma } from "@prisma/client";
import { createAppInjector } from "~/app-injector.server";
import { HttpError } from "~/http-error.server";
import { DEFAULT_SEATS_LIMIT } from "~/license/constants";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";

import type { UserService } from "./user.service.server";

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

    for (let i = 0; i < DEFAULT_SEATS_LIMIT - 1; i++) {
      await userService.getOrCreateUser(db, {
        externalId: `abc${i}`,
        gitEmail: `dev${i}@example.com`,
      });
    }
    try {
      await userService.getOrCreateUser(db, {
        externalId: "toomany",
        gitEmail: "toomany@example.com",
      });
      throw new Error("Should have thrown");
    } catch (err) {
      expect(err instanceof HttpError).toBe(true);
    }
  }),
);
