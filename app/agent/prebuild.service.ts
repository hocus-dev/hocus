import type { PrebuildEvent, Prisma } from "@prisma/client";
import { LogGroupType, VmTaskStatus } from "@prisma/client";

export class PrebuildService {
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
        const logGroup = await db.logGroup.create({
          data: {
            type: LogGroupType.LOG_GROUP_TYPE_VM_TASK,
          },
        });
        const paths = this.getPrebuildTaskPaths(idx);
        const vmTask = await db.vmTask.create({
          data: {
            command: [
              "bash",
              "-o",
              "pipefail",
              "-o",
              "errexit",
              "-c",
              `bash "${paths.scriptPath}" 2>&1 | tee "${paths.logPath}"`,
            ],
            logGroupId: logGroup.id,
            status: VmTaskStatus.VM_TASK_STATUS_PENDING,
          },
        });
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
