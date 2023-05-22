import { defineSignal, defineQuery } from "@temporalio/workflow";

import type { valueof } from "~/types/utils";

export type WaitRequestType = valueof<typeof WaitRequestType>;
export const WaitRequestType = {
  WAIT: "wait",
  CANCEL: "cancel",
} as const;

export interface WaitRequest {
  initiatorWorkflowId: string;
  releaseSignalId: string;
  type: WaitRequestType;
}

export interface FinishedExecutionRequest {
  initiatorWorkflowId: string;
}

export const waitRequestSignal = defineSignal<[WaitRequest]>("wait-requested");
export const requestsQuery = defineQuery<WaitRequest[]>("requests");
export const sharedWorkflowIdQuery = defineQuery<string>("shared-workflow-id");

export class WorkflowCancelledError extends Error {
  public readonly name = "WorkflowCancelledError";
  public readonly message = "Workflow was cancelled";
}

export const getWaitingWorkflowId = (lockId: string) => `waiting-${lockId}`;
