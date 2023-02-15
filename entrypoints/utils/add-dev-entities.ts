/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient, SshKeyPairType } from "@prisma/client";
import { nanoid } from "nanoid";
import { createAgentInjector } from "~/agent/agent-injector";
import { runAddProjectAndRepository } from "~/agent/workflows";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { Token } from "~/token";

async function run() {
  const injector = createAgentInjector();
  const agentConfig = injector.resolve(Token.Config).agent();
  const db = new PrismaClient({ datasources: { db: { url: agentConfig.databaseUrl } } });
  const sshKeyService = injector.resolve(Token.SshKeyService);
  await sshKeyService.createSshKeyPair(
    db,
    PRIVATE_SSH_KEY,
    SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
  );

  const withClient = injector.resolve(Token.TemporalClient);
  await withClient(async (client) => {
    console.log(`Starting workflow...`);
    const result = await client.workflow.execute(runAddProjectAndRepository, {
      workflowId: nanoid(),
      taskQueue: MAIN_TEMPORAL_QUEUE,
      retry: { maximumAttempts: 1 },
      args: [
        {
          gitRepositoryUrl: TESTS_REPO_URL,
          projectName: "Hocus Tests",
          projectWorkspaceRoot: "/",
        },
      ],
    });
    console.log(result);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
