import type { SpawnSyncOptionsWithBufferEncoding, SpawnSyncReturns } from "child_process";
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";

import type { SSHExecCommandResponse, SSHExecOptions, Config as SSHConfig } from "node-ssh";
import { NodeSSH } from "node-ssh";
import { Tail } from "tail";
import type { Object } from "ts-toolbelt";
import { unwrap } from "~/utils.shared";

export const execCmd = (...args: string[]): SpawnSyncReturns<Buffer> => {
  return execCmdWithOpts(args, {});
};

export const execCmdWithOpts = (
  args: string[],
  options: Object.Modify<
    SpawnSyncOptionsWithBufferEncoding,
    { env?: Record<string, string | undefined> }
  >,
): SpawnSyncReturns<Buffer> => {
  const output = spawnSync(args[0], args.slice(1), options as SpawnSyncOptionsWithBufferEncoding);
  if (output.status !== 0) {
    throw new Error(
      `Command "${args.join(" ")}" failed with status ${output.status}, error name: "${
        output.error?.name
      }", error message: "${output.error?.message}", and output:\n${output.output?.toString()}`,
    );
  }
  return output;
};

/**
 * Note to readers: in order for `options.opts.execOptions.env` to be respected,
 * the SSH server on the remote machine must be configured to allow the user to
 * set environment variables. For example, this can be done by adding the
 * following lines to `/etc/ssh/sshd_config`:
 *
 * ```
 * PermitUserEnvironment yes
 * AcceptEnv *
 * ```
 *
 * See https://github.com/hugodutka/rooms/blob/3fad5769181f9117896d53885afa9b18af3146d0/resources/docker/fetchrepo.Dockerfile#L24-L25
 * for an example in a Dockerfile.
 */
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

export const withSsh = async <T>(
  connectionOptions: SSHConfig,
  fn: (ssh: NodeSSH) => Promise<T>,
): Promise<T> => {
  const ssh = await retry(async () => await new NodeSSH().connect(connectionOptions), 10, 250);
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

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const randomString = (length: number): string => {
  return [...Array(length)].map(() => Math.random().toString(36)[2]).join("");
};

export const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number,
): Promise<T> => {
  let lastError: unknown = void 0;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await sleep(retryDelayMs);
      }
    }
  }
  throw lastError;
};

export const doesFileExist = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return false;
    }
    throw err;
  }
};

export const sha256 = (str: Buffer | string): string => {
  return createHash("sha256").update(str).digest("hex");
};
