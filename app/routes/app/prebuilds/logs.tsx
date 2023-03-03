import type { LoaderArgs } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "~/http-error.server";
import { PrebuildLogsValidator } from "~/schema/prebuild-logs.validator.server";

export const loader = async ({ context: { db, req, res } }: LoaderArgs) => {
  const { success, value: query } = PrebuildLogsValidator.SafeParse(req.query);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid query");
  }
  const prebuildEvent = await db.prebuildEvent.findUnique({
    where: {
      externalId: query.prebuildExternalId,
    },
    include: {
      tasks: {
        include: {
          vmTask: true,
        },
      },
      buildfsEvent: {
        include: {
          vmTask: true,
        },
      },
    },
  });
  if (prebuildEvent == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Prebuild not found");
  }
  const vmTasks = prebuildEvent.tasks
    .map((task) => task.vmTask)
    .concat(prebuildEvent.buildfsEvent?.vmTask ?? []);
  const vmTask = vmTasks.find((task) => task.externalId === query.taskExternalId);
  if (vmTask == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Task not found");
  }

  const logs = await db.log.findMany({
    where: {
      logGroupId: vmTask.logGroupId,
    },
    orderBy: {
      idx: "asc",
    },
  });
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-disposition", `attachment; filename=${vmTask.externalId}.log`);
  res.charset = "utf-8";
  for (const log of logs) {
    res.write(log.content);
  }
  res.end();

  return;
};
