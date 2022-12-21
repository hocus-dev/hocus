import type { PrebuildEvent, Prisma } from "@prisma/client";
import { Token } from "~/token";

import type { AgentUtilService } from "./agent-util.service";

export class PrebuildService {
  static inject = [Token.AgentUtilService] as const;

  constructor(private readonly agentUtilService: AgentUtilService) {}

  devDir = "/home/hocus/dev" as const;
  repositoryDir = `${this.devDir}/project` as const;
  prebuildScriptsDir = `${this.devDir}/.hocus/init` as const;

  getPrebuildTaskPaths(taskIdx: number): {
    scriptPath: string;
    logPath: string;
  } {
    const scriptPath = `${this.prebuildScriptsDir}/task-${taskIdx}.sh`;
    const logPath = `${this.prebuildScriptsDir}/task-${taskIdx}.log`;
    return { scriptPath, logPath };
  }

  async createPrebuildEvent(
    db: Prisma.TransactionClient,
    projectId: bigint,
    gitObjectId: bigint,
    tasks: string[],
  ): Promise<PrebuildEvent> {
    const prebuildEvent = await db.prebuildEvent.create({ data: { projectId, gitObjectId } });
    await Promise.all(
      tasks.map(async (task, idx) => {
        const paths = this.getPrebuildTaskPaths(idx);
        const vmTask = await this.agentUtilService.createVmTask(db, [
          "bash",
          "-o",
          "pipefail",
          "-o",
          "errexit",
          "-o",
          "allexport",
          "-c",
          `bash "${paths.scriptPath}" 2>&1 | tee "${paths.logPath}"`,
        ]);
        await db.prebuildEventTask.create({
          data: {
            prebuildEventId: prebuildEvent.id,
            vmTaskId: vmTask.id,
            idx,
            originalCommand: task,
          },
        });
      }),
    );
    return prebuildEvent;
  }

  async linkGitBranchesToPrebuildEvent(db: Prisma.TransactionClient, prebuildEventId: bigint) {
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: prebuildEventId },
    });
    const gitBranches = await db.gitBranch.findMany({
      where: { gitObjectId: prebuildEvent.gitObjectId },
    });
    await db.prebuildEventToGitBranch.createMany({
      data: gitBranches.map((gitBranch) => ({
        prebuildEventId,
        gitBranchId: gitBranch.id,
      })),
    });
  }

  /**
   * Creates a prebuild event and links all git branches that point to the given git object id to it.
   */
  async preparePrebuild(
    db: Prisma.TransactionClient,
    projectId: bigint,
    gitObjectId: bigint,
    tasks: string[],
  ): Promise<PrebuildEvent> {
    const prebuildEvent = await this.createPrebuildEvent(db, projectId, gitObjectId, tasks);
    await this.linkGitBranchesToPrebuildEvent(db, prebuildEvent.id);
    return prebuildEvent;
  }
}
