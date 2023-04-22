import { Context } from "@temporalio/activity";

import type { CreateActivity } from "../types";

import type { LockRequest } from "./shared";
import { lockRequestSignal } from "./shared";

import { Token } from "~/token";

export type SignalWithStartLockWorkflowActivity = (
  resourceId: string,
  timeoutMs: number,
) => Promise<void>;
export const signalWithStartLockWorkflow: CreateActivity<SignalWithStartLockWorkflowActivity> =
  ({ injector }) =>
  async (resourceId: string, timeoutMs: number) => {
    const req: LockRequest = {
      initiatorId: Context.current().info.workflowExecution.workflowId,
      timeoutMs,
    };
    const withClient = injector.resolve(Token.TemporalClient);
    await withClient(async (client) => {
      await client.workflow.signalWithStart("lockWorkflow", {
        taskQueue: Context.current().info.taskQueue,
        workflowId: resourceId,
        signal: lockRequestSignal,
        signalArgs: [req],
      });
    });
  };
