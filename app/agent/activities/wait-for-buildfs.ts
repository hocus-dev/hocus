import { VmTaskStatus } from "@prisma/client";
import { sleep } from "~/utils.shared";

import { retry } from "../utils";

import type { CreateActivity } from "./types";

const FAILED_STATES = [
  VmTaskStatus.VM_TASK_STATUS_ERROR,
  VmTaskStatus.VM_TASK_STATUS_CANCELLED,
] as const;

export type WaitForBuildfsActivity = (buildfsEventId: bigint, timeoutMs: number) => Promise<void>;
export const waitForBuildfs: CreateActivity<WaitForBuildfsActivity> =
  ({ db }) =>
  async (buildfsEventId, timeoutMs) => {
    const startAt = Date.now();
    while (true) {
      const buildfsEvent = await retry(
        () =>
          db.buildfsEvent.findUnique({
            where: { id: buildfsEventId },
            include: {
              vmTask: true,
            },
          }),
        5,
        250,
      );
      if (!buildfsEvent) {
        throw new Error("Buildfs event not found");
      }
      if (buildfsEvent.vmTask.status === VmTaskStatus.VM_TASK_STATUS_SUCCESS) {
        return;
      }
      if (FAILED_STATES.includes(buildfsEvent.vmTask.status as any)) {
        throw new Error(`Buildfs is in ${buildfsEvent.vmTask.status} state`);
      }
      if (Date.now() - startAt > timeoutMs) {
        throw new Error("Timeout waiting for buildfs");
      }
      await sleep(2500);
    }
  };
