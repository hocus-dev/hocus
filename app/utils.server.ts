import fs from "fs/promises";
import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

export const getLogsFromGroup = async (
  db: Prisma.Client,
  logGroupId: bigint,
  limit?: number,
): Promise<Buffer> => {
  const logs = await db.log.findMany({
    where: {
      logGroupId,
    },
    orderBy: {
      idx: "desc",
    },
    take: limit,
  });

  return Buffer.concat(logs.map((log) => log.content).reverse());
};

export const sha256 = (str: Buffer | string): string => {
  return createHash("sha256").update(str).digest("hex");
};

export const doesFileExist = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return false;
    }
    throw err;
  }
};

export const runOnTimeout = async <T>(
  opts: { waitFor: Promise<T>; timeoutMs: number },
  runOnTimeoutFn: () => void,
): Promise<{ ok: true; result: T } | { ok: false; result?: undefined }> => {
  let timeout: NodeJS.Timeout | undefined;
  const result = await Promise.race([
    opts.waitFor.then((result) => ({ ok: true, result } as const)),
    new Promise<undefined>((resolve) => {
      timeout = setTimeout(() => {
        runOnTimeoutFn();
        resolve(void 0);
      }, opts.timeoutMs);
    }),
  ]);
  clearTimeout(timeout);
  if (result === void 0) {
    return { ok: false };
  }
  return result;
};
