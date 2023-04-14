import type { VmTaskStatus } from "@prisma/client";

export type VMTaskOutput = { vmTaskId: bigint } & (
  | {
      status: (typeof VmTaskStatus)["VM_TASK_STATUS_SUCCESS"];
    }
  | {
      status: (typeof VmTaskStatus)["VM_TASK_STATUS_ERROR"];
      error: Error;
    }
  | {
      status: (typeof VmTaskStatus)["VM_TASK_STATUS_CANCELLED"];
    }
);
