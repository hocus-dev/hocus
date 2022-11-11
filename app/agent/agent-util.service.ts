import fsSync from "fs";
import { promisify } from "util";

import type { DefaultLogger } from "@temporalio/worker";
import type { NodeSSH } from "node-ssh";
import { Token } from "~/token";

import { PREBUILD_SCRIPT_TEMPLATE } from "./constants";
import { execCmd, execSshCmd } from "./utils";

export class AgentUtilService {
  static inject = [Token.Logger] as const;
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

  generatePrebuildScript(task: string): string {
    return `${PREBUILD_SCRIPT_TEMPLATE}${task}\n`;
  }
}
