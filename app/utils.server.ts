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
