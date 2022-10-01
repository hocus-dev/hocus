import type { PrismaClient } from "@prisma/client";
import { createAppInjector } from "~/app-injector.server";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";

import type { UserService } from "./user.service.server";

type Args = {
  db: PrismaClient;
  userService: UserService;
};

const provideUserService = (testFn: (args: Args) => Promise<void>): (() => Promise<void>) => {
  return provideDb(async (db) => {
    const userService = createAppInjector().resolve(Token.UserService);
    await testFn({ db, userService });
  });
};

test.concurrent(
  "loginOrRegisterUser",
  provideUserService(async ({ db, userService }) => {
    const externalId = "123";

    const user = await userService.loginOrRegisterUser(db, externalId, "github");
    expect(user.externalId).toEqual(externalId);
  }),
);
