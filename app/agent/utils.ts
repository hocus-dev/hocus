import type { SpawnOptionsWithoutStdio } from "child_process";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

import type { Log } from "@prisma/client";
import { Context } from "@temporalio/activity";
import type { DefaultLogger, Logger } from "@temporalio/worker";
import { Mutex } from "async-mutex";
import type { SSHExecCommandResponse, SSHExecOptions, Config as SSHConfig } from "node-ssh";
import { NodeSSH } from "node-ssh";
import lockfile from "proper-lockfile";
import { Tail } from "tail";
import type { Object } from "ts-toolbelt";

import { doesFileExist } from "~/utils.server";
import { unwrap } from "~/utils.shared";

export const execCmd = async (...args: string[]): Promise<{ stdout: string; stderr: string }> => {
  return await execCmdWithOpts(args, {});
};

export class ExecCmdError extends Error {
  constructor(public readonly status: number | null, public readonly message: string) {
    super(message);
  }
}

export const execCmdWithOpts = async (
  args: string[],
  options: Object.Overwrite<
    SpawnOptionsWithoutStdio,
    { env?: Record<string, string | undefined>; cwd?: string | undefined }
  >,
): Promise<{ stdout: string; stderr: string; pid?: number }> => {
  return await new Promise((resolve, reject) => {
    const cp = spawn(args[0], args.slice(1), options as SpawnOptionsWithoutStdio);
    let stdout = "";
    let stderr = "";
    cp.stdout.on("data", (data) => {
      stdout += data;
    });
    cp.stderr.on("data", (data) => {
      stderr += data;
    });
    cp.on("error", reject);
    cp.on("close", (status) => {
      if (status !== 0) {
        reject(
          new ExecCmdError(
            status,
            `Command "${args.join(
              " ",
            )}" failed with status ${status}, stdout: "${stdout}", stderr: ${stderr}`,
          ),
        );
      } else {
        resolve({
          stdout,
          stderr,
        });
      }
    });
  });
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
 * See https://github.com/hocus-dev/hocus/blob/3fad5769181f9117896d53885afa9b18af3146d0/resources/docker/fetchrepo.Dockerfile#L24-L25
 * for an example in a Dockerfile.
 */
export const execSshCmd = async (
  options: {
    ssh: NodeSSH;
    opts?: SSHExecOptions;
    allowNonZeroExitCode?: boolean;
  },
  args: string[],
): Promise<SSHExecCommandResponse> => {
  const { ssh, opts, allowNonZeroExitCode } = options;
  const logger = (ssh as any)["_hocus_logger"] as Logger;

  if (logger) {
    logger.debug(`Executing command ${args} via SSH`);
  } else {
    // eslint-disable-next-line no-console
    console.error(`No logger found. Executing command ${args} via SSH`);
  }
  const output = await ssh.exec(args[0], args.slice(1), {
    ...opts,
    stream: "both",
  });
  if (!allowNonZeroExitCode && output.code !== 0) {
    throw new Error(
      `Command "${args.join(" ")}" failed with code ${output.code}, stdout:\n${
        output.stdout
      }\n\nstderr:\n${output.stderr}`,
    );
  }
  return output;
};

export const withSsh = async <T>(
  connectionOptions: SSHConfig,
  logger: DefaultLogger,
  fn: (ssh: NodeSSH) => Promise<T>,
  abortController?: AbortController,
): Promise<T> => {
  const ssh = await retry(
    async () => {
      if (abortController === void 0 || !abortController.signal.aborted) {
        logger.debug("Trying to connect to VM via SSH");
        return await new NodeSSH().connect({
          keepaliveInterval: 250,
          keepaliveCountMax: 4,
          timeout: 2000,
          readyTimeout: 2000,
          ...connectionOptions,
        });
      }
    },
    15,
    500,
  );
  if (ssh === void 0) {
    if (abortController !== void 0) abortController.signal.throwIfAborted();
    throw new Error("Failed to establish ssh connection");
  }

  logger.debug("Connected to VM via SSH");
  (ssh as any)["_hocus_logger"] = logger;

  ssh.connection?.on("error", (err) => {
    logger.info(err.toString());
    abortController?.abort(err);
  });

  const context = getActivityContext();
  let finish: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });

  let cancellationHandled: Promise<void> | null = null;
  if (context != null) {
    cancellationHandled = Promise.race([context.cancelled, finished]).catch(() => {
      try {
        ssh.connection?.destroy();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to destroy SSH connection: ${err}`);
      }
    });
  }

  try {
    try {
      return await fn(ssh);
    } finally {
      ssh.connection?.destroy();
      ssh.dispose();
    }
  } finally {
    finish();
    await cancellationHandled;
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

export const isProcessAlive = async (pid: number): Promise<boolean> => {
  return await doesFileExist(path.join("/proc", pid.toString()));
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
    // We use a mutex because the same process cannot attempt to lock the same file twice.
    // If there were two async functions trying to lock the storage file at the same time,
    // one of them would fail.
    //
    // TODO: Consider using a different method of locking, such as flock. I have experienced
    // flaky behavior in tests with lockfile, namely the "Lockfile is already being held" error.
    // The problem is that we are using this function within Temporal workflows, and I'm not sure
    // if the `lockedFilePaths` map is shared across activities running concurrently on the
    // same machine. As a workaround I slapped the 10 retries on the lockfile call below,
    // but that's not a great solution.
    return await locked2.mutex.runExclusive(async () => {
      const unlockFile = await lockfile.lock(lockFilePath, { retries: 10 });
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

export const withFileLockCreateIfNotExists = async <T>(
  lockFilePath: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const exists = await doesFileExist(lockFilePath);
  if (!exists) {
    await fs.mkdir(path.dirname(lockFilePath), { recursive: true });
    await fs.appendFile(lockFilePath, "");
  }
  return await withFileLock(lockFilePath, fn);
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

/** Returns null if not running inside an activity. */
export const getActivityContext = (): Context | null => {
  try {
    return Context.current();
  } catch (err) {
    return null;
  }
};
