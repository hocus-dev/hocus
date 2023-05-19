import { Context } from "@temporalio/activity";

import type { CreateActivity } from "../types";

import { getSharedWorkflowId, getWaitingWorkflowId, waitRequestSignal } from "./shared";
import type { WaitRequest } from "./shared";
import type { WaitRequestType } from "./shared";

import { runWaitForWorkflow } from "~/agent/workflows";
import { Token } from "~/token";

export type SignalWithStartWaitWorkflowActivity = (args: {
  releaseSignalId: string;
  waitRequestType: WaitRequestType;
  lockId: string;
  workflow: string;
  params: unknown[];
}) => Promise<void>;
export const signalWithStartWaitWorkflow: CreateActivity<SignalWithStartWaitWorkflowActivity> =
  ({ injector }) =>
  async (args) => {
    const req: WaitRequest = {
      initiatorWorkflowId: Context.current().info.workflowExecution.workflowId,
      type: args.waitRequestType,
      releaseSignalId: args.releaseSignalId,
    };
    const withClient = injector.resolve(Token.TemporalClient);
    await withClient(async (client) => {
      await client.workflow.signalWithStart(runWaitForWorkflow, {
        taskQueue: Context.current().info.taskQueue,
        workflowId: getWaitingWorkflowId(args.lockId),
        args: [
          {
            workflow: args.workflow,
            params: args.params,
            workflowId: getSharedWorkflowId(args.lockId),
          },
        ],
        signal: waitRequestSignal,
        signalArgs: [req],
      });
    });
  };
