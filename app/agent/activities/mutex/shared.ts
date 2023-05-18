import type { WorkflowExecutionStatusName } from "@temporalio/client";
import { defineQuery, defineSignal } from "@temporalio/workflow";

export interface LockRequest {
  initiatorWorkflowId: string;
  lockAcquiredSignalName: string;
}

export const currentWorkflowIdQuery = defineQuery<string | null>("current-workflow-id");
export const lockRequestSignal = defineSignal<[LockRequest]>("lock-requested");
export const wakeSignal = defineSignal<[]>("wake");

export type FINAL_WORKFLOW_EXECUTION_STATUS_NAMES =
  (typeof FINAL_WORKFLOW_EXECUTION_STATUS_NAMES)[number];
export const FINAL_WORKFLOW_EXECUTION_STATUS_NAMES = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TERMINATED",
  "TIMED_OUT",
  "CUSTOM_NOT_FOUND",
] as const;
const _typeCheck: Partial<WorkflowExecutionStatusName | "CUSTOM_NOT_FOUND"> =
  "" as FINAL_WORKFLOW_EXECUTION_STATUS_NAMES;
