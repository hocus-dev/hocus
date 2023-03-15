import { PrebuildEventStatus, SshKeyPairType } from "@prisma/client";
import type { Partial } from "ts-toolbelt/out/Object/Partial";
import { HttpError } from "~/http-error.server";
import { provideAppInjectorAndDb } from "~/test-utils";
import { TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { Token } from "~/token";
import { createTestUser } from "~/user/test-utils";
import { groupBy, unwrap } from "~/utils.shared";

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
      TESTS_PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    const repo = await db.$transaction((tdb) =>
      gitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id),
    );
    const project = await db.$transaction((tdb) =>
      projectService.createProject(tdb, {
        gitRepositoryId: repo.id,
        rootDirectoryPath: "/",
        name: "test",
      }),
    );
    const runCase = async (args: Partial<UpdateEnvVarsArgs>) => {
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
    const getUserEnvVars = () =>
      db.userProjectEnvironmentVariableSet
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
          r.environmentSet.environmentVariables.sort((a, b) => a.name.localeCompare(b.name)),
        );
    const getProjectEnvVars = () =>
      db.project
        .findUniqueOrThrow({
          where: { id: project.id },
          include: {
            environmentVariableSet: {
              include: {
                environmentVariables: true,
              },
            },
          },
        })
        .then((r) =>
          r.environmentVariableSet.environmentVariables.sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
    const userEnvVars = await getUserEnvVars();
    expect(userEnvVars.map((v) => [v.name, v.value])).toEqual([
      ["name1", "value1"],
      ["name2", "value2"],
    ]);
    await runCase({
      update: [
        { name: "name1_updated", value: "value1_updated", externalId: userEnvVars[0].externalId },
      ],
      delete: [userEnvVars[1].externalId],
    });
    const userEnvVars2 = await getUserEnvVars();
    expect(userEnvVars2.map((v) => [v.name, v.value])).toEqual([
      ["name1_updated", "value1_updated"],
    ]);
    await runCase({
      target: UpdateEnvVarsTarget.PROJECT,
      create: [
        { name: "name3", value: "value3" },
        { name: "name4", value: "value4" },
        { name: "name5", value: "value5" },
      ],
    });
    const projectEnvVars = await getProjectEnvVars();
    expect(projectEnvVars.map((v) => [v.name, v.value])).toEqual([
      ["name3", "value3"],
      ["name4", "value4"],
      ["name5", "value5"],
    ]);
    try {
      await runCase({
        target: UpdateEnvVarsTarget.PROJECT,
        update: [{ externalId: userEnvVars2[0].externalId, name: "name1_fail" }],
      });
    } catch (e) {
      if (e instanceof HttpError) {
        expect(e.statusText).toMatch(/not found/);
      } else {
        throw e;
      }
    }
  }),
);

test.concurrent(
  "getLatestPrebuildsByBranch",
  provideAppInjectorAndDb(async ({ injector, db }) => {
    const projectService = injector.resolve(Token.ProjectService);
    const gitService = injector.resolve(Token.GitService);
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const pair = await sshKeyService.createSshKeyPair(
      db,
      TESTS_PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    const repo = await db.$transaction((tdb) =>
      gitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id),
    );
    const project = await db.$transaction((tdb) =>
      projectService.createProject(tdb, {
        gitRepositoryId: repo.id,
        rootDirectoryPath: "/",
        name: "test",
      }),
    );
    const gitBranchArgs = ["a", "b", "c", "d", "e", "f"].map((name, idx) => ({
      name,
      gitObjectHash: `hash${idx}`,
      runningPrebuild: idx % 2 === 0,
      pendingInitPrebuild: idx % 3 === 0,
      pendingReadyPrebuild: idx % 4 === 0,
      finishedPrebuild: idx % 2 === 1,
    }));
    for (const args of gitBranchArgs) {
      const gitObject = await db.gitObject.create({
        data: {
          hash: args.gitObjectHash,
        },
      });
      const gitBranch = await db.gitBranch.create({
        data: {
          name: args.name,
          gitObjectId: gitObject.id,
          gitRepositoryId: repo.id,
        },
      });
      for (const status of Array.from(Object.values(PrebuildEventStatus)).sort()) {
        for (const createdAt of [1, 2, 3]) {
          if (
            status === PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_INIT &&
            !args.pendingInitPrebuild
          ) {
            continue;
          }
          if (
            status === PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_READY &&
            !args.pendingReadyPrebuild
          ) {
            continue;
          }
          if (
            status === PrebuildEventStatus.PREBUILD_EVENT_STATUS_RUNNING &&
            !args.runningPrebuild
          ) {
            continue;
          }
          if (
            status === PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS &&
            !args.finishedPrebuild
          ) {
            continue;
          }

          await db.prebuildEvent.create({
            data: {
              createdAt: new Date(createdAt),
              status,
              project: {
                connect: {
                  id: project.id,
                },
              },
              gitObject: {
                connect: {
                  id: gitObject.id,
                },
              },
              gitBranchLinks: {
                create: {
                  gitBranch: {
                    connect: {
                      id: gitBranch.id,
                    },
                  },
                },
              },
            },
          });
        }
      }
    }

    const latestPrebuilds = await projectService.getLatestPrebuildsByBranch(db, {
      projectExternalId: project.externalId,
    });
    const latestPrebuildsByBranchName = groupBy(
      latestPrebuilds,
      (prebuild) => prebuild.branch.name,
      (prebuild) => prebuild,
    );
    for (const args of gitBranchArgs) {
      if (
        !(
          args.finishedPrebuild ||
          args.pendingInitPrebuild ||
          args.pendingReadyPrebuild ||
          args.runningPrebuild
        )
      ) {
        continue;
      }
      const results = unwrap(latestPrebuildsByBranchName.get(args.name));
      expect(results.length).toEqual(1);
      const result = results[0];
      if (args.finishedPrebuild) {
        const prebuild = unwrap(result.finishedPrebuild);
        expect(prebuild.status).toEqual(PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS);
        expect(prebuild.createdAt.getTime()).toEqual(3);
      }
      if (args.runningPrebuild) {
        const prebuild = unwrap(result.ongoingPrebuild);
        expect(prebuild.status).toEqual(PrebuildEventStatus.PREBUILD_EVENT_STATUS_RUNNING);
        expect(prebuild.createdAt.getTime()).toEqual(3);
      } else if (args.pendingInitPrebuild) {
        const prebuild = unwrap(result.ongoingPrebuild);
        expect(prebuild.status).toEqual(PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_INIT);
        expect(prebuild.createdAt.getTime()).toEqual(3);
      } else if (args.pendingReadyPrebuild) {
        const prebuild = unwrap(result.ongoingPrebuild);
        expect(prebuild.status).toEqual(PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_READY);
        expect(prebuild.createdAt.getTime()).toEqual(3);
      }
    }
  }),
);
