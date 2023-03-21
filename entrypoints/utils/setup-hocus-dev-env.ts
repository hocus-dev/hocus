/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient, SshKeyPairType } from "@prisma/client";
import type { Client } from "@temporalio/client";
import { nanoid } from "nanoid";
import { runAddProjectAndRepository } from "~/agent/workflows";
import type { AppInjector } from "~/app-injector.server";
import { createAppInjector } from "~/app-injector.server";
import { DEV_USER_EXTERNAL_ID, DEV_USER_SSH_PUBLIC_KEY } from "~/dev/constants";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { HOCUS_REPO_URL, TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

async function addDevRepo(
  client: Client,
  workflowArgs: Parameters<typeof runAddProjectAndRepository>[0],
) {
  console.log(`Starting workflow...`);
  const result = await client.workflow.execute(runAddProjectAndRepository, {
    workflowId: nanoid(),
    taskQueue: MAIN_TEMPORAL_QUEUE,
    retry: { maximumAttempts: 1 },
    args: [workflowArgs],
  });
  console.log(result);
}

async function setupDevUser(db: PrismaClient, injector: AppInjector) {
  const agentDevConfig = injector.resolve(Token.Config).agentDev();
  const sshKeyService = injector.resolve(Token.SshKeyService);
  const userService = injector.resolve(Token.UserService);
  console.log("Setting up dev@example.com user");
  const devUser = await userService.getOrCreateUser(db, {
    externalId: DEV_USER_EXTERNAL_ID,
    gitEmail: agentDevConfig.gitEmail,
    gitName: agentDevConfig.gitName,
  });
  await db.$transaction(async (tdb) => {
    await sshKeyService.createPublicSshKeyForUser(tdb, devUser.id, DEV_USER_SSH_PUBLIC_KEY, "Dev");
  });
}

async function setupDevelopementProjects(db: PrismaClient, client: Client, injector: AppInjector) {
  const sshKeyService = injector.resolve(Token.SshKeyService);
  console.log("Creating projects for Hocus developement");

  const testsKeyPair = await sshKeyService.createSshKeyPair(
    db,
    TESTS_PRIVATE_SSH_KEY,
    SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
  );
  await addDevRepo(client, {
    gitRepositoryUrl: TESTS_REPO_URL,
    projectName: "Hocus Tests",
    projectWorkspaceRoot: "/",
    sshKeyPairId: testsKeyPair.id,
  });
}

async function setupHocusProjects(db: PrismaClient, client: Client, injector: AppInjector) {
  const sshKeyService = injector.resolve(Token.SshKeyService);
  const repoAccess = injector.resolve(Token.Config).hocusRepoAccess();
  console.log("Creating projects for Hocus in Hocus");

  const hocusRepoKeyPair = await sshKeyService.createSshKeyPair(
    db,
    repoAccess.hocusRepoPrivateKey,
    SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
  );
  await waitForPromises([
    addDevRepo(client, {
      gitRepositoryUrl: HOCUS_REPO_URL,
      projectName: "Hocus Vscode Workspace Extension",
      projectWorkspaceRoot: "/extensions/vscode_workspace",
      sshKeyPairId: hocusRepoKeyPair.id,
    }),

    addDevRepo(client, {
      gitRepositoryUrl: HOCUS_REPO_URL,
      projectName: "Hocus Vscode UI Extension",
      projectWorkspaceRoot: "/extensions/vscode_ui",
      sshKeyPairId: hocusRepoKeyPair.id,
    }),

    addDevRepo(client, {
      gitRepositoryUrl: HOCUS_REPO_URL,
      projectName: "Hocus Agent+CP",
      projectWorkspaceRoot: "/",
      sshKeyPairId: hocusRepoKeyPair.id,
    }),
  ]);
}

export async function setupHocusDevEnv() {
  const injector = createAppInjector();
  const agentConfig = injector.resolve(Token.Config).agent();
  const db = new PrismaClient({ datasources: { db: { url: agentConfig.databaseUrl } } });

  await setupDevUser(db, injector);

  const withClient = injector.resolve(Token.TemporalClient);
  await withClient(async (client) => {
    await waitForPromises([
      !agentConfig.createDevelopementProjects
        ? Promise.resolve()
        : setupDevelopementProjects(db, client, injector),
      !agentConfig.createHocusProjects
        ? Promise.resolve()
        : setupHocusProjects(db, client, injector),
    ]);
  });
}
