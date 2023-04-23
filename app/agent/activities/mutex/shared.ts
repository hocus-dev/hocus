import { defineQuery, defineSignal } from "@temporalio/workflow";

export interface LockRequest {
  initiatorWorkflowId: string;
  lockAcquiredSignalName: string;
  timeoutMs: number;
}

export const currentWorkflowIdQuery = defineQuery<string | null>("current-workflow-id");
export const lockRequestSignal = defineSignal<[LockRequest]>("lock-requested");
