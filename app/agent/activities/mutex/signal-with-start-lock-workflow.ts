import { Context } from "@temporalio/activity";

import type { CreateActivity } from "../types";

import type { LockRequest } from "./shared";
import { lockRequestSignal } from "./shared";

import { Token } from "~/token";

export type SignalWithStartLockWorkflowActivity = (
  resourceId: string,
  lockAcquiredSignalName: string,
) => Promise<void>;
export const signalWithStartLockWorkflow: CreateActivity<SignalWithStartLockWorkflowActivity> =
  ({ injector }) =>
  async (resourceId: string, lockAcquiredSignalName: string) => {
    const req: LockRequest = {
      initiatorWorkflowId: Context.current().info.workflowExecution.workflowId,
      lockAcquiredSignalName,
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
