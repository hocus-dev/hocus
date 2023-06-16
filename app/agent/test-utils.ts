import fs from "fs/promises";

import { v4 as uuidv4 } from "uuid";

import { SSH_PROXY_IP } from "./test-constants";
import { execCmd } from "./utils";

export const execSshCmdThroughProxy = async (args: {
  vmIp: string;
  privateKey: string;
  cmd: string;
}): Promise<{ stdout: string; stderr: string }> => {
  const keyPath = `/tmp/${uuidv4()}.key` as const;
  try {
    await fs.writeFile(keyPath, args.privateKey);
    await fs.chmod(keyPath, 0o600);
    return await execCmd(
      "ip",
      "netns",
      "exec",
      "tst",
      "ssh",
      "-o",
      `ProxyCommand=ssh -W %h:%p -o StrictHostKeyChecking=no -i ${keyPath} sshgateway@${SSH_PROXY_IP}`,
      "-o",
      "StrictHostKeyChecking=no",
      "-i",
      keyPath,
      `hocus@${args.vmIp}`,
      args.cmd,
    );
  } finally {
    await fs.unlink(keyPath).catch((_) => {
      // do nothing
    });
  }
};
