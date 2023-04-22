import { defineQuery, defineSignal } from "@temporalio/workflow";

export interface LockRequest {
  initiatorId: string;
  timeoutMs: number;
}

interface LockResponse {
  releaseSignalName: string;
}

export const currentWorkflowIdQuery = defineQuery<string | null>("current-workflow-id");
export const lockRequestSignal = defineSignal<[LockRequest]>("lock-requested");
export const lockAcquiredSignal = defineSignal<[LockResponse]>("lock-acquired");
