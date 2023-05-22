import type { WorkflowExecutionStatusName } from "@temporalio/client";
import { defineQuery, defineSignal } from "@temporalio/workflow";

export interface LockRequest {
  initiatorWorkflowId: string;
  lockAcquiredSignalName: string;
}

export interface LockRelease {
  releaseId: string;
}

export const currentWorkflowIdQuery = defineQuery<string | null>("current-workflow-id");
export const lockRequestSignal = defineSignal<[LockRequest]>("lock-requested");
export const lockReleaseSignal = defineSignal<[LockRelease]>("lock-released");
export const wakeSignal = defineSignal<[]>("wake");

export type NotFoundExecutionStatus = typeof NotFoundExecutionStatus;
export const NotFoundExecutionStatus = "CUSTOM_NOT_FOUND" as const;

export type FINAL_WORKFLOW_EXECUTION_STATUS_NAMES =
  (typeof FINAL_WORKFLOW_EXECUTION_STATUS_NAMES)[number];
export const FINAL_WORKFLOW_EXECUTION_STATUS_NAMES = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TERMINATED",
  "TIMED_OUT",
  NotFoundExecutionStatus,
] as const;
const _typeCheck: Partial<WorkflowExecutionStatusName | NotFoundExecutionStatus> =
  "" as FINAL_WORKFLOW_EXECUTION_STATUS_NAMES;
