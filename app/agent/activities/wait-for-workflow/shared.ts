import { defineSignal } from "@temporalio/workflow";

import type * as Workflows from "~/agent/workflows";
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
export const finishedExecutionSignal =
  defineSignal<[FinishedExecutionRequest]>("finished-execution");

export type AwaitableWorkflows = Omit<typeof Workflows, "runWaitForWorkflow">;
export type AwaitableWorkflow = valueof<{
  [Name in keyof AwaitableWorkflows]: {
    id: string;
    name: Name;
    params: Parameters<AwaitableWorkflows[Name]>;
  };
}>;
