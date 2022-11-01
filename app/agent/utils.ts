import type { SpawnSyncReturns } from "child_process";
import { spawnSync } from "child_process";

import { NodeSSH } from "node-ssh";

export const execCmd = (...args: string[]): SpawnSyncReturns<Buffer> => {
  const output = args.length > 1 ? spawnSync(args[0], args.slice(1)) : spawnSync(args[0]);
  if (output.status !== 0) {
    throw new Error(
      `Command "${args.join(" ")}" failed with status ${output.status}, error name: "${
        output.error?.name
      }", error message: "${output.error?.message}", and output:\n${output.output?.toString()}`,
    );
  }
  return output;
};

export const createExt4Image = (
  imagePath: string,
  sizeMiB: number,
  overwrite: boolean = false,
): void => {
  if (overwrite) {
    execCmd("rm", "-f", imagePath);
  }
  execCmd("dd", "if=/dev/zero", `of=${imagePath}`, "bs=1M", "count=0", `seek=${sizeMiB}`);
  execCmd("mkfs.ext4", imagePath);
};

export const withSsh = async <T>(
  connectionOptions: Parameters<NodeSSH["connect"]>[0],
  fn: (ssh: NodeSSH) => Promise<T>,
): Promise<T> => {
  const ssh = await new NodeSSH().connect(connectionOptions);
  try {
    return await fn(ssh);
  } finally {
    ssh.dispose();
  }
};
