import { v4 as uuidv4 } from "uuid";

import type { CreateActivity } from "./types";
import { runActivityHeartbeat } from "./utils";

import { Token } from "~/token";

export type FetchRepositoryActivity = (
  gitRepositoryId: bigint,
  tmpContentPrefix: string,
) => Promise<void>;
export const fetchRepository: CreateActivity<FetchRepositoryActivity> =
  ({ injector, db }) =>
  async (gitRepositoryId, tmpContentPrefix) => {
    const instanceId = `fetchrepo-${uuidv4()}`;
    const runtime = injector.resolve(Token.QemuService)(instanceId);
    const gitService = injector.resolve(Token.AgentGitService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const perfService = injector.resolve(Token.PerfService);
    perfService.log("fetchRepository", "start", gitRepositoryId);
    await runActivityHeartbeat({ intervalMs: 5000 }, async () => {
      const repo = await db.gitRepository.findUniqueOrThrow({
        where: { id: gitRepositoryId },
        include: {
          sshKeyPair: true,
        },
      });
      const repoImage = await db.$transaction(async (tdb) => {
        const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);
        return await gitService.getOrCreateGitRepoImage(tdb, agentInstance.id, repo.id);
      });
      await gitService.fetchRepository({
        runtime,
        outputId: repoImage.localOciImage.tag,
        tmpContentPrefix,
        repository: {
          url: repo.url,
          credentials: {
            privateSshKey: repo.sshKeyPair.privateKey,
          },
        },
      });
    });
    perfService.log("fetchRepository", "end", gitRepositoryId);
  };
