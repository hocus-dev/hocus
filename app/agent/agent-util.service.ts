import fsSync from "fs";
import path from "path";

import type { AgentInstance, Prisma, VmTask } from "@prisma/client";
import { LogGroupType } from "@prisma/client";
import { VmTaskStatus } from "@prisma/client";
import type { DefaultLogger } from "@temporalio/worker";
import type { NodeSSH, Config as SSHConfig } from "node-ssh";
import type { Config } from "~/config";
import { config } from "~/config";
import { GroupError } from "~/group-error";
import { Token } from "~/token";
import { unwrap, waitForPromises } from "~/utils.shared";

import type { VMTaskOutput } from "./agent-util.types";
import { SOLO_AGENT_INSTANCE_ID, TASK_SCRIPT_TEMPLATE } from "./constants";
import { execCmd, ExecCmdError, execSshCmd, sleep, withSsh } from "./utils";

export class AgentUtilService {
  static inject = [Token.Logger] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(private readonly logger: DefaultLogger) {
    this.agentConfig = config.agent();
  }

  createExt4Image(imagePath: string, sizeMiB: number, overwrite: boolean = false): void {
    const fileExists = fsSync.existsSync(imagePath);
    if (overwrite) {
      if (fileExists) {
        this.logger.warn(`file already exists at "${imagePath}", it will be overwritten`);
      }
      execCmd("rm", "-f", imagePath);
    } else if (fileExists) {
      throw new Error(`Image file "${imagePath}" already exists`);
    }
    fsSync.mkdirSync(path.dirname(imagePath), { recursive: true });
    execCmd("dd", "if=/dev/zero", `of=${imagePath}`, "bs=1M", "count=0", `seek=${sizeMiB}`);
    execCmd("mkfs.ext4", imagePath);
  }

  async expandDriveImage(drivePath: string, appendSizeMiB: number): Promise<void> {
    execCmd("dd", "if=/dev/zero", `of=${drivePath}`, "bs=1M", "count=0", `seek=${appendSizeMiB}`);
    try {
      execCmd("resize2fs", drivePath);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("e2fsck"))) {
        throw err;
      }
      try {
        execCmd("e2fsck", "-fp", drivePath);
      } catch (e2fsckErr) {
        // status code meaning from e2fsck man page:
        // 1 - File system errors corrected
        // 2 - File system errors corrected, system should be rebooted
        if (!(e2fsckErr instanceof ExecCmdError && [1, 2].includes(e2fsckErr.status as any))) {
          throw e2fsckErr;
        }
      }
      execCmd("resize2fs", drivePath);
    }
  }

  getDriveUuid(drivePath: string): string {
    const fileOutput = execCmd("blkid", drivePath).stdout.toString();
    const uuidMatch = fileOutput.match(/UUID="([^"]+)"/);
    if (!uuidMatch) {
      throw new Error(`Could not find UUID for drive "${drivePath}"`);
    }
    return uuidMatch[1];
  }

  async mountDriveAtPath(
    ssh: NodeSSH,
    hostDrivePath: string,
    guestMountPath: string,
    useSudo: boolean = true,
  ): Promise<void> {
    try {
      const cmdPrefix = useSudo ? ["sudo"] : [];
      const driveUuid = this.getDriveUuid(hostDrivePath);
      await execSshCmd({ ssh }, [...cmdPrefix, "mkdir", "-p", guestMountPath]);
      await execSshCmd({ ssh }, [...cmdPrefix, "mount", `UUID=${driveUuid}`, guestMountPath]);
    } catch (err) {
      throw new Error(`Failed to mount drive "${hostDrivePath}" at "${guestMountPath}": ${err}`);
    }
  }

  async writeFile(ssh: NodeSSH, path: string, content: string): Promise<void> {
    // I don't use SFTP because I've found it to be unreliable, causing
    // untraceable errors.
    try {
      await execSshCmd(
        {
          ssh,
          opts: {
            execOptions: {
              env: {
                FILE_CONTENT: content,
              } as any,
            },
          },
        },
        ["bash", "-c", `echo -n "$FILE_CONTENT" > ${path}`],
      );
    } catch (err) {
      throw new Error(`Failed to write file "${path}": ${(err as any)?.message}`);
    }
  }

  async readFile(ssh: NodeSSH, path: string): Promise<string> {
    // I don't use SFTP because I've found it to be unreliable, causing
    // untraceable errors.
    try {
      const output = await execSshCmd({ ssh }, ["cat", path]);
      return output.stdout;
    } catch (err) {
      throw new Error(`Failed to read file "${path}": ${(err as any)?.message}`);
    }
  }

  generateTaskScript(task: string): string {
    return `${TASK_SCRIPT_TEMPLATE}${task}\n`;
  }

  generateEnvVarsScript(vars: { name: string; value: string }[]): string {
    return (
      vars
        .map((v) => {
          const base64Encoded = Buffer.from(v.value).toString("base64");
          return `export ${v.name}=$(echo "${base64Encoded}" | base64 -d)`;
        })
        .join("\n") + "\n"
    );
  }

  async createVmTask(
    db: Prisma.TransactionClient,
    task: { command: string[]; cwd: string },
  ): Promise<VmTask> {
    return await db.vmTask.create({
      data: {
        status: VmTaskStatus.VM_TASK_STATUS_PENDING,
        command: task.command,
        cwd: task.cwd,
        logGroup: { create: { type: LogGroupType.LOG_GROUP_TYPE_VM_TASK } },
      },
      include: { logGroup: true },
    });
  }

  async execVmTasks(
    sshConfig: SSHConfig,
    db: Prisma.Client,
    vmTasks: { vmTaskId: bigint; env?: { [name: string]: string } }[],
  ): Promise<VMTaskOutput[]> {
    const tasks = await db.vmTask.findMany({
      where: { id: { in: vmTasks.map((t) => t.vmTaskId) } },
      include: { logGroup: true },
    });
    for (const vmTask of tasks) {
      if (vmTask.status !== VmTaskStatus.VM_TASK_STATUS_PENDING) {
        throw new Error(
          `VM task ${vmTask.id} status is ${vmTask.status} instead of ${VmTaskStatus.VM_TASK_STATUS_PENDING}`,
        );
      }
    }
    const idsToVmTasks = new Map(vmTasks.map((t) => [t.vmTaskId, t]));
    const taskDefinitions = tasks.map((t) => ({
      task: t,
      env: unwrap(idsToVmTasks.get(t.id)).env,
    }));

    let cleanupStarted = false;
    const taskSshHandles: NodeSSH[] = [];
    const taskFn = async (args: typeof taskDefinitions[0]) => {
      await withSsh(sshConfig, async (taskSsh) => {
        if (cleanupStarted) {
          throw new Error("cleanup already started");
        }
        taskSshHandles.push(taskSsh);

        let finished = false;
        let syncCounter = 0;
        let logBuffer: Buffer[] = [];
        const syncLogs = async () => {
          let lastSync = 0;
          while (!finished) {
            await sleep(Math.max(0, lastSync + 1000 - Date.now()));
            lastSync = Date.now();
            if (cleanupStarted) {
              throw new Error("cleanup started");
            }
            if (logBuffer.length === 0) {
              continue;
            }
            const currentSyncIdx = syncCounter;
            syncCounter += 1;

            const content = Buffer.concat(logBuffer);
            logBuffer = [];
            await db.log.create({
              data: {
                idx: currentSyncIdx,
                logGroupId: args.task.logGroupId,
                content,
              },
            });
          }
        };

        await waitForPromises([
          execSshCmd(
            {
              ssh: taskSsh,
              opts: {
                cwd: args.task.cwd ?? void 0,
                execOptions: {
                  env: args.env as any,
                },
                onStdout: (chunk) => logBuffer.push(chunk),
                onStderr: (chunk) => logBuffer.push(chunk),
              },
            },
            args.task.command,
          ).finally(() => (finished = true)),
          syncLogs().catch((err) => {
            taskSsh.dispose();
            throw err;
          }),
        ]);
      });
    };
    const taskFinished = tasks.map((_) => false);
    const taskCancelled = tasks.map((_) => false);
    const taskPromises = taskDefinitions.map(async (args, taskIdx) => {
      const updateStatus = (status: VmTaskStatus) =>
        db.vmTask.update({
          where: { id: args.task.id },
          data: { status },
        });

      try {
        try {
          await updateStatus(VmTaskStatus.VM_TASK_STATUS_RUNNING);
          await taskFn(args);
          await updateStatus(VmTaskStatus.VM_TASK_STATUS_SUCCESS);
        } finally {
          taskFinished[taskIdx] = true;
        }
      } catch (err) {
        if (!cleanupStarted) {
          cleanupStarted = true;
          for (const [idx, isFinished] of taskFinished.entries()) {
            taskCancelled[idx] = !isFinished;
          }
          // this is done to interrupt the other tasks, withSsh will dispose the
          // ssh handles anyway
          await Promise.all(taskSshHandles.map((sshHandle) => sshHandle.dispose()));
        }

        try {
          await updateStatus(
            taskCancelled[taskIdx]
              ? VmTaskStatus.VM_TASK_STATUS_CANCELLED
              : VmTaskStatus.VM_TASK_STATUS_ERROR,
          );
        } catch (updateErr) {
          throw new GroupError([err, updateErr]);
        }

        throw err;
      }
    });
    const results = await Promise.allSettled(taskPromises);
    const statuses = results.map((result, idx) => {
      if (result.status === "rejected") {
        if (taskCancelled[idx]) {
          return {
            status: VmTaskStatus.VM_TASK_STATUS_CANCELLED,
          };
        }
        return {
          status: VmTaskStatus.VM_TASK_STATUS_ERROR,
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        };
      } else {
        return { status: VmTaskStatus.VM_TASK_STATUS_SUCCESS };
      }
    });
    return tasks.map((task, idx) => ({ vmTaskId: task.id, ...statuses[idx] }));
  }

  async getOrCreateSoloAgentInstance(db: Prisma.TransactionClient): Promise<AgentInstance> {
    return await db.agentInstance.upsert({
      where: { externalId: SOLO_AGENT_INSTANCE_ID },
      update: {},
      create: {
        externalId: SOLO_AGENT_INSTANCE_ID,
      },
    });
  }
}
