import fs from "fs/promises";

import { doesFileExist, execCmdAsync } from "./utils";

export class SSHGatewayService {
  async addPublicKeysToAuthorizedKeys(keys: string[]): Promise<void> {
    const gatewayUser = "sshgateway";
    const sshDirectory = `/home/${gatewayUser}/.ssh`;
    const authorizedKeysPath = `${sshDirectory}/authorized_keys`;
    const fileExists = await doesFileExist(authorizedKeysPath);
    if (!fileExists) {
      await fs.mkdir(sshDirectory, { recursive: true });
      await fs.appendFile(authorizedKeysPath, "");
      await execCmdAsync("chown", "-R", `${gatewayUser}:${gatewayUser}`, sshDirectory);
      await fs.chmod(authorizedKeysPath, "600");
    }

    const fileContents = await fs.readFile(authorizedKeysPath, "utf-8");
    const authorizedKeys = new Set(
      fileContents
        .trim()
        .split("\n")
        .filter((line) => line.length > 0),
    );
    const newKeys = keys.filter((key) => !authorizedKeys.has(key));
    if (newKeys.length === 0) {
      return;
    }
    const payload = `${fileContents.endsWith("\n") ? "" : "\n"}${newKeys.join("\n")}\n"`;
    await fs.appendFile(authorizedKeysPath, payload);
  }
}
