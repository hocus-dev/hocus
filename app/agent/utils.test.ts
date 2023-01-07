import fs from "fs/promises";
import os from "os";
import path from "path";

import { Mutex } from "async-mutex";
import { v4 as uuidv4 } from "uuid";

import { withFileLock, sleep, withManyFileLocks } from "./utils";

test.concurrent("withFileLock", async () => {
  const runId = uuidv4();
  const pathToLockFile = path.join(os.tmpdir(), `withFileLock-${runId}.lock`);
  await fs.appendFile(pathToLockFile, "test");

  try {
    const mutex = new Mutex();
    const releaser = await mutex.acquire();

    const results: number[] = [];
    await Promise.all([
      (async () => {
        await withFileLock(pathToLockFile, async () => {
          results.push(1);
          releaser();
          await sleep(50);
          results.push(2);
        });
      })(),
      (async () => {
        const localReleaser = await mutex.acquire();
        await withFileLock(pathToLockFile, async () => {
          results.push(3);
        });
        localReleaser();
      })(),
    ]);

    expect(results).toEqual([1, 2, 3]);
  } finally {
    await fs.rm(pathToLockFile);
  }
});

test.concurrent("withManyFileLocks", async () => {
  const runId = uuidv4();
  const paths = Array.from({ length: 5 }).map((_, idx) =>
    path.join(os.tmpdir(), `withFileLock-${runId}-${idx}.lock`),
  );
  await Promise.all(paths.map((path) => fs.appendFile(path, "test")));

  try {
    const mutexes = [new Mutex(), new Mutex()] as const;
    const releasers = await Promise.all(mutexes.map((mutex) => mutex.acquire()));

    const results: number[] = [];
    await Promise.all([
      (async () => {
        await withManyFileLocks(paths, async () => {
          results.push(1);
          releasers[0]();
          await sleep(50);
          results.push(2);
        });
      })(),
      (async () => {
        const localReleaser = await mutexes[0].acquire();
        await withManyFileLocks(paths, async () => {
          results.push(3);
          releasers[1]();
          await sleep(50);
          results.push(4);
        });
        localReleaser();
      })(),
      (async () => {
        const localReleaser = await mutexes[1].acquire();
        await withFileLock(paths[2], async () => {
          results.push(5);
        });
        localReleaser();
      })(),
    ]);

    expect(results).toEqual([1, 2, 3, 4, 5]);
  } finally {
    await Promise.all(paths.map((path) => fs.rm(path)));
  }
});
