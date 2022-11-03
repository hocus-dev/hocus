import type { SpawnSyncReturns } from "child_process";
import { spawnSync } from "child_process";
import fs from "fs";

import type { SSHExecCommandResponse, SSHExecOptions } from "node-ssh";
import { NodeSSH } from "node-ssh";
import { Tail } from "tail";
import { unwrap } from "~/utils.shared";

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

export const execSshCmd = async (
  options: {
    ssh: NodeSSH;
    opts?: SSHExecOptions;
    allowNonZeroExitCode?: boolean;
    logFilePath?: string;
  },
  args: string[],
): Promise<SSHExecCommandResponse> => {
  const { ssh, opts, logFilePath, allowNonZeroExitCode } = options;
  let logFile: number | undefined = void 0;
  try {
    if (logFilePath != null) {
      logFile = fs.openSync(logFilePath, "w");
    }
    const output = await ssh.exec(args[0], args.slice(1), {
      ...opts,
      stream: "both",
      ...(logFile != null
        ? {
            onStdout: (chunk) => fs.writeSync(unwrap(logFile), chunk),
            onStderr: (chunk) => fs.writeSync(unwrap(logFile), chunk),
          }
        : {}),
    });
    if (!allowNonZeroExitCode && output.code !== 0) {
      throw new Error(
        `Command "${args.join(" ")}" failed with code ${output.code}, stdout:\n${
          output.stdout
        }\n\nstderr:\n${output.stderr}`,
      );
    }
    return output;
  } finally {
    if (logFile != null) {
      fs.closeSync(logFile);
    }
  }
};

export const createExt4Image = (
  imagePath: string,
  sizeMiB: number,
  overwrite: boolean = false,
): void => {
  if (overwrite) {
    execCmd("rm", "-f", imagePath);
  } else {
    if (fs.existsSync(imagePath)) {
      throw new Error(`Image file "${imagePath}" already exists`);
    }
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

export const watchFileUntilLineMatches = (
  regex: RegExp,
  filePath: string,
  timeoutMs: number,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(`Timeout reached while waiting for line matching ${regex} in file ${filePath}`),
      );
    }, timeoutMs);
    const tail = new Tail(filePath);

    const cleanup = () => {
      clearTimeout(timeout);
      tail.unwatch();
    };
    const handleError = <T extends (...args: any[]) => any>(fn: T) => {
      return (...args: Parameters<T>) => {
        try {
          fn(...args);
        } catch (err) {
          reject(err);
        }
      };
    };

    tail.on(
      "line",
      handleError((line) => {
        if (regex.test(line)) {
          cleanup();
          resolve();
        }
      }),
    );
    tail.on(
      "error",
      handleError((error) => {
        cleanup();
        reject(error);
      }),
    );
    tail.watch();
  });
};
