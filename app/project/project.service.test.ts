import { SshKeyPairType } from "@prisma/client";
import type { Object } from "ts-toolbelt";
import { provideAppInjectorAndDb } from "~/test-utils";
import { PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { Token } from "~/token";
import { createTestUser } from "~/user/test-utils";

import { UpdateEnvVarsTarget } from "./env-form.shared";
import type { UpdateEnvVarsArgs } from "./project.service";

test.concurrent(
  "updateEnvironmentVariables",
  provideAppInjectorAndDb(async ({ injector, db }) => {
    const projectService = injector.resolve(Token.ProjectService);
    const gitService = injector.resolve(Token.GitService);
    const testUser = await createTestUser(db);
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const pair = await sshKeyService.createSshKeyPair(
      db,
      PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    const repo = await gitService.addGitRepository(db, TESTS_REPO_URL, pair.id);
    const project = await db.$transaction((tdb) =>
      projectService.createProject(tdb, {
        gitRepositoryId: repo.id,
        rootDirectoryPath: "/",
        name: "test",
      }),
    );
    const runCase = async (args: Object.Partial<UpdateEnvVarsArgs>) => {
      await db.$transaction(async (tdb) => {
        await projectService.updateEnvironmentVariables(tdb, {
          userId: args.userId ?? testUser.id,
          projectExternalId: args.projectExternalId ?? project.externalId,
          delete: args.delete ?? [],
          create: args.create ?? [],
          update: args.update ?? [],
          target: args.target ?? UpdateEnvVarsTarget.USER,
        });
      });
    };
    await runCase({
      create: [
        { name: "name1", value: "value1" },
        { name: "name2", value: "value2" },
      ],
    });
    const userEnvVars = await db.userProjectEnvironmentVariableSet
      .findUniqueOrThrow({
        where: {
          // eslint-disable-next-line camelcase
          userId_projectId: {
            userId: testUser.id,
            projectId: project.id,
          },
        },
        include: {
          environmentSet: {
            include: {
              environmentVariables: true,
            },
          },
        },
      })
      .then((r) =>
        r.environmentSet.environmentVariables
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((v) => [v.name, v.value]),
      );
    expect(userEnvVars).toEqual([
      ["name1", "value1"],
      ["name2", "value2"],
    ]);
  }),
);
