import fs from "fs/promises";

import { SshKeyPairType } from "@prisma/client";
import { Worker } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createActivities } from "~/agent/activities/list";
import { createAgentInjector } from "~/agent/agent-injector";
import { createAppInjector } from "~/app-injector.server";
import {
  TESTS_PRIVATE_SSH_KEY,
  TESTS_PUBLIC_SSH_KEY,
  TESTS_REPO_URL,
} from "~/test-utils/constants";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

// Temporal worker setup is long
jest.setTimeout(30 * 1000);

const USER1_ID = "b7b83d63-a9b0-4871-92d0-07779f28cfa8";
const USER2_ID = "166908ef-15d0-498f-88e3-bfd97cf5d21b";

const EXPECTED_CONFIG = {
  repos: [
    {
      url: "git@github.com:hocus-dev/tests.git",
      publicKey: TESTS_PUBLIC_SSH_KEY,
      privateKey: TESTS_PRIVATE_SSH_KEY,
    },
  ],
  users: [
    {
      externalId: "166908ef-15d0-498f-88e3-bfd97cf5d21b",
      git: {
        username: "username_166908ef-15d0-498f-88e3-bfd97cf5d21b",
        email: "email_166908ef-15d0-498f-88e3-bfd97cf5d21b",
      },
      publicKeys: [
        {
          publicKey: "pk_166908ef-15d0-498f-88e3-bfd97cf5d21b",
          name: "name_166908ef-15d0-498f-88e3-bfd97cf5d21b",
        },
      ],
    },
    {
      externalId: "b7b83d63-a9b0-4871-92d0-07779f28cfa8",
      git: {
        username: "username_b7b83d63-a9b0-4871-92d0-07779f28cfa8",
        email: "email_b7b83d63-a9b0-4871-92d0-07779f28cfa8",
      },
      publicKeys: [
        {
          publicKey: "pk_b7b83d63-a9b0-4871-92d0-07779f28cfa8",
          name: "name_b7b83d63-a9b0-4871-92d0-07779f28cfa8",
        },
      ],
    },
  ],
  projects: [
    {
      name: "test",
      externalId: "6f5157ef-a51e-489e-890f-6637983a4b3c",
      repoUrl: "git@github.com:hocus-dev/tests.git",
      rootDirectoryPath: "/",
      env: {
        project: { a: "3", b: "2", c: "1" },
        user: {
          "166908ef-15d0-498f-88e3-bfd97cf5d21b": { a1: "1", b1: "2", c1: "3" },
          "b7b83d63-a9b0-4871-92d0-07779f28cfa8": { a0: "1", b0: "2", c0: "3" },
        },
      },
      config: {
        maxPrebuildRamMib: 1,
        maxPrebuildVCPUCount: 2,
        maxWorkspaceRamMib: 3,
        maxWorkspaceVCPUCount: 4,
      },
    },
  ],
};

test.concurrent(
  "getInitConfig",
  new TestEnvironmentBuilder(createAppInjector)
    .withTestLogging()
    .withTestDb()
    .run(async ({ injector, db }) => {
      const initService = injector.resolve(Token.InitService);
      const sshKeyService = injector.resolve(Token.SshKeyService);
      const gitService = injector.resolve(Token.GitService);

      await waitForPromises(
        [USER1_ID, USER2_ID].map((externalId) =>
          db.user.create({
            data: {
              externalId,
              active: true,
              sshPublicKeys: {
                create: {
                  name: "name_" + externalId,
                  publicKey: "pk_" + externalId,
                },
              },
              gitConfig: {
                create: {
                  gitEmail: "email_" + externalId,
                  gitUsername: "username_" + externalId,
                },
              },
            },
          }),
        ),
      );

      const pair = await sshKeyService.createSshKeyPair(
        db,
        TESTS_PRIVATE_SSH_KEY,
        SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
      );
      const repo = await db.$transaction((tdb) =>
        gitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id),
      );
      await db.project.create({
        data: {
          name: "test",
          rootDirectoryPath: "/",
          externalId: "6f5157ef-a51e-489e-890f-6637983a4b3c",
          maxPrebuildRamMib: 1,
          maxPrebuildVCPUCount: 2,
          maxWorkspaceRamMib: 3,
          maxWorkspaceVCPUCount: 4,
          gitRepository: {
            connect: {
              id: repo.id,
            },
          },
          environmentVariableSet: {
            create: {
              environmentVariables: {
                create: [
                  { name: "a", value: "3" },
                  { name: "b", value: "2" },
                  { name: "c", value: "1" },
                ],
              },
            },
          },
          UserProjectEnvironmentVariableSet: {
            create: [USER1_ID, USER2_ID].map((externalId, idx) => ({
              user: { connect: { externalId } },
              environmentSet: {
                create: {
                  environmentVariables: {
                    create: [
                      { name: `a${idx}`, value: "1" },
                      { name: `b${idx}`, value: "2" },
                      { name: `c${idx}`, value: "3" },
                    ],
                  },
                },
              },
            })),
          },
        },
      });
      const initConfig = await initService["getInitConfig"](db);
      expect(initConfig).toEqual(EXPECTED_CONFIG);
    }),
);

test.concurrent(
  "dump and load",
  new TestEnvironmentBuilder(createAppInjector).withTestLogging().run(async ({ injector }) => {
    const initService = injector.resolve(Token.InitService);
    const filePath = `/tmp/init-config-test-${uuidv4()}`;
    await initService["dumpInitConfigToFile"](filePath, EXPECTED_CONFIG);
    const loadedConfig = await initService["loadInitConfigFromFile"](filePath);
    const stringifiedConfig = initService["stringifyInitConfig"](loadedConfig);
    const expectedStringifiedConfig = initService["stringifyInitConfig"](EXPECTED_CONFIG);
    expect(stringifiedConfig).toEqual(expectedStringifiedConfig);
    await fs.rm(filePath);
  }),
);

test.concurrent(
  "loadConfig",
  new TestEnvironmentBuilder(createAppInjector)
    .withTestLogging()
    .withTestDb()
    .withLocalTemporal()
    .run(async ({ injector, db, temporalTestEnv, workflowBundle }) => {
      const taskQueue = `test-${uuidv4()}`;
      const initService = injector.resolve(Token.InitService);
      initService["temporalQueue"] = taskQueue;
      const initConfig = EXPECTED_CONFIG;

      const agentInjector = createAgentInjector();
      const activities = await createActivities(agentInjector, db);

      const worker = await Worker.create({
        connection: temporalTestEnv.nativeConnection,
        taskQueue,
        workflowsPath: require.resolve("~/agent/workflows"),
        activities: {
          ...activities,
          updateGitBranchesAndObjects: async () => ({
            newGitBranches: [],
            updatedGitBranches: [],
          }),
        },
        dataConverter: {
          payloadConverterPath: require.resolve("~/temporal/data-converter"),
        },
        workflowBundle,
      });

      const initialInitConfig = await initService["getInitConfig"](db);
      expect(initialInitConfig).toEqual({
        projects: [],
        repos: [],
        users: [],
      });

      await worker.runUntil(async () => {
        for (const _ of [1, 2, 3]) {
          await initService["loadConfig"](db, temporalTestEnv.client, initConfig);
          const updatedInitConfig = await initService["getInitConfig"](db);
          expect(updatedInitConfig).toEqual(initConfig);
        }
      });
    }),
);
