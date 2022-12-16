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

  async createPrebuildEvent(db: Prisma.TransactionClient, tasks: string[]): Promise<PrebuildEvent> {
    const prebuildEvent = await db.prebuildEvent.create({ data: {} });
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
}
