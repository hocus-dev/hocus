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
