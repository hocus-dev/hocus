import { createAppInjector } from "~/app-injector.server";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";

const userServiceTestEnv = new TestEnvironmentBuilder(createAppInjector)
  .withTestLogging()
  .withTestDb()
  .withLateInits({
    userService: async ({ injector }) => injector.resolve(Token.UserService),
  });

test.concurrent(
  "getOrCreateUser",
  userServiceTestEnv.run(async ({ db, userService }) => {
    const externalId = "123";

    const user = await userService.getOrCreateUser(db, {
      externalId,
      gitEmail: "dev@example.com",
    });
    const userWithExtras = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { gitConfig: true },
    });
    expect(user.externalId).toEqual(externalId);
    expect(userWithExtras.gitConfig.gitEmail).toEqual("dev@example.com");
    expect(userWithExtras.gitConfig.gitUsername).toEqual("dev");
  }),
);
