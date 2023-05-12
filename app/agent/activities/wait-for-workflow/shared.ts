import { defineSignal } from "@temporalio/workflow";

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

export const waitRequestSignal = defineSignal<[WaitRequest]>("wait-requested");
