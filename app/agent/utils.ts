import type { SpawnSyncOptionsWithBufferEncoding, SpawnSyncReturns } from "child_process";
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";

import type { Log } from "@prisma/client";
import { Mutex } from "async-mutex";
import type { SSHExecCommandResponse, SSHExecOptions, Config as SSHConfig } from "node-ssh";
import { NodeSSH } from "node-ssh";
import lockfile from "proper-lockfile";
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
    try {
      // I don't know why, but ssh2 can't properly dispose of SFTP
      // connections. There seem to be some unconsumed requests
      // on the sftp subsystem channel and when ssh2 tries to
      // close the channel, it throws an error. This is a workaround
      // to drain the channel. Maybe this is a concurrency issue when
      // you use withSFTP several times at the same time?
      // Note that SFTP functionality itself works fine.
      //
      // Error message: "Unable to start subsystem: sftp"
      // Error stack:
      // https://github.com/mscdex/ssh2/blob/24b497ddf2d727ecf3e3e6d414a5ba6172fe320f/lib/client.js#L1762
      // https://github.com/mscdex/ssh2/blob/24b497ddf2d727ecf3e3e6d414a5ba6172fe320f/lib/utils.js#L76
      // https://github.com/mscdex/ssh2/blob/24b497ddf2d727ecf3e3e6d414a5ba6172fe320f/lib/utils.js#L200
      // https://github.com/mscdex/ssh2/blob/24b497ddf2d727ecf3e3e6d414a5ba6172fe320f/lib/client.js#L769
      await ssh.withSFTP(async () => {});
    } catch {
      // Ignore error
    }
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
  isRetriable: (err: unknown) => boolean = () => true,
): Promise<T> => {
  let lastError: unknown = void 0;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetriable(err)) {
        throw err;
      }
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

const lockedFilePaths = new Map<string, { mutex: Mutex; numLocks: number }>();
export const withFileLock = async <T>(lockFilePath: string, fn: () => Promise<T>): Promise<T> => {
  const locked1 = lockedFilePaths.get(lockFilePath);
  if (locked1 != null) {
    locked1.numLocks++;
  } else {
    lockedFilePaths.set(lockFilePath, { mutex: new Mutex(), numLocks: 1 });
  }
  const locked2 = unwrap(lockedFilePaths.get(lockFilePath));

  try {
    return await locked2.mutex.runExclusive(async () => {
      const unlockFile = await lockfile.lock(lockFilePath);
      try {
        return await fn();
      } finally {
        await unlockFile();
      }
    });
  } finally {
    const locked3 = unwrap(lockedFilePaths.get(lockFilePath));
    locked3.numLocks--;
    if (locked3.numLocks === 0) {
      lockedFilePaths.delete(lockFilePath);
    }
  }
};

export const withManyFileLocks = async <T>(
  /**
   * Make sure these paths are unique. An error will be thrown if they are not.
   * Otherwise a deadlock would occur.
   * */
  lockFilePaths: string[],
  fn: () => Promise<T>,
): Promise<T> => {
  const seenPaths = new Set<string>();

  let fnComposite = fn;
  for (const lockFilePath of lockFilePaths) {
    if (seenPaths.has(lockFilePath)) {
      throw new Error(`Duplicate lock file path: ${lockFilePath}`);
    }
    seenPaths.add(lockFilePath);

    const innerFnCopy = fnComposite;
    fnComposite = () => withFileLock(lockFilePath, innerFnCopy);
  }
  return await fnComposite();
};

export const logErrors = <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      throw err;
    }
  }) as T;
};

/** Sorts the logs argument, concatenates logs, and returns a string. */
export const parseVmTaskLogs = (logs: Log[]): string => {
  return Buffer.concat(logs.sort((a, b) => a.idx - b.idx).map((l) => l.content)).toString("utf8");
};
