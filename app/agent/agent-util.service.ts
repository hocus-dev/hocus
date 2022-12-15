import fsSync from "fs";
import { promisify } from "util";

import type { Prisma, VmTask } from "@prisma/client";
import { VmTaskStatus } from "@prisma/client";
import type { DefaultLogger } from "@temporalio/worker";
import type { NodeSSH, Config as SSHConfig } from "node-ssh";
import { GroupError } from "~/group-error";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

import type { VMTaskOutput } from "./agent-util.types";
import { TASK_SCRIPT_TEMPLATE } from "./constants";
import { execCmd, execSshCmd, sleep, withSsh } from "./utils";

export class AgentUtilService {
  static inject = [Token.Logger, Token.StorageService] as const;
  constructor(private readonly logger: DefaultLogger) {}

  createExt4Image(imagePath: string, sizeMiB: number, overwrite: boolean = false): void {
    if (overwrite) {
      this.logger.warn(`file already exists at "${imagePath}", it will be overwritten`);
      execCmd("rm", "-f", imagePath);
    } else {
      if (fsSync.existsSync(imagePath)) {
        throw new Error(`Image file "${imagePath}" already exists`);
      }
    }
    execCmd("dd", "if=/dev/zero", `of=${imagePath}`, "bs=1M", "count=0", `seek=${sizeMiB}`);
    execCmd("mkfs.ext4", imagePath);
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
    const cmdPrefix = useSudo ? ["sudo"] : [];
    const driveUuid = this.getDriveUuid(hostDrivePath);
    await execSshCmd({ ssh }, [...cmdPrefix, "mkdir", "-p", guestMountPath]);
    await execSshCmd({ ssh }, [...cmdPrefix, "mount", `UUID=${driveUuid}`, guestMountPath]);
  }

  async writeFile(ssh: NodeSSH, path: string, content: string): Promise<void> {
    await ssh.withSFTP(async (sftp) => {
      const writeFile = promisify(sftp.writeFile.bind(sftp));
      await writeFile(path, content);
    });
  }

  generateTaskScript(task: string): string {
    return `${TASK_SCRIPT_TEMPLATE}${task}\n`;
  }

  execVmTasks = async (
    sshConfig: SSHConfig,
    db: Prisma.Client,
    vmTaskIds: bigint[],
  ): Promise<VMTaskOutput[]> => {
    const tasks = await db.vmTask.findMany({
      where: { id: { in: vmTaskIds } },
      include: { logGroup: true },
    });
    for (const vmTask of tasks) {
      if (vmTask.status !== VmTaskStatus.VM_TASK_STATUS_PENDING) {
        throw new Error(`VM task ${vmTask.id} is not in pending state`);
      }
    }

    let cleanupStarted = false;
    const taskSshHandles: NodeSSH[] = [];
    const taskFn = async (task: VmTask) => {
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
                logGroupId: task.logGroupId,
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
                cwd: task.cwd ?? void 0,
                onStdout: (chunk) => logBuffer.push(chunk),
                onStderr: (chunk) => logBuffer.push(chunk),
              },
            },
            task.command,
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
    const taskPromises = tasks.map(async (task, taskIdx) => {
      const updateStatus = (status: VmTaskStatus) =>
        db.vmTask.update({
          where: { id: task.id },
          data: { status },
        });

      try {
        try {
          await updateStatus(VmTaskStatus.VM_TASK_STATUS_RUNNING);
          await taskFn(task);
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
  };
}
