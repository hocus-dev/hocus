import { VmTaskStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import type { CreateActivity } from "./types";
import { withActivityHeartbeat } from "./utils";

import { Token } from "~/token";

export type BuildfsActivity = (args: {
  buildfsEventId: bigint;
}) => Promise<{ buildSuccessful: boolean; error?: string }>;
export const buildfs: CreateActivity<BuildfsActivity> = ({ injector, db }) =>
  withActivityHeartbeat({ intervalMs: 5000 }, async (args) => {
    const instanceId = `buildfs-${uuidv4()}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const buildfsService = injector.resolve(Token.BuildfsService);
    const perfService = injector.resolve(Token.PerfService);

    const buildfsEvent = await db.buildfsEvent.findUniqueOrThrow({
      where: { id: args.buildfsEventId },
      include: { vmTask: true },
    });
    const status = buildfsEvent.vmTask.status;
    if (status === VmTaskStatus.VM_TASK_STATUS_SUCCESS) {
      return { buildSuccessful: true };
    }
    if (
      [VmTaskStatus.VM_TASK_STATUS_ERROR, VmTaskStatus.VM_TASK_STATUS_CANCELLED].includes(
        status as any,
      )
    ) {
      return { buildSuccessful: false, error: `Buildfs vm task status: ${status}` };
    }

    perfService.log("buildfs", "start", args.buildfsEventId);
    const result = await buildfsService.buildfs({ ...args, db, firecrackerService });
    perfService.log("buildfs", "end", args.buildfsEventId);

    return result;
  });
