import { Context } from "@temporalio/activity";

import type { CreateActivity } from "../types";

import type { AwaitableWorkflows, WaitRequest } from "./shared";
import { waitRequestSignal } from "./shared";
import { WaitRequestType } from "./shared";

import { runWaitForWorkflow } from "~/agent/workflows";
import type { WithSharedWorkflowParams } from "~/agent/workflows/wait-for-workflow";
import { Token } from "~/token";

export type SignalWithStartWaitWorkflowActivity = <K extends keyof AwaitableWorkflows>(
  args: {
    releaseSignalId: string;
  } & WithSharedWorkflowParams<K>,
) => Promise<void>;
export const signalWithStartWaitWorkflow: CreateActivity<SignalWithStartWaitWorkflowActivity> =
  ({ injector }) =>
  async (args) => {
    const req: WaitRequest = {
      initiatorWorkflowId: Context.current().info.workflowExecution.workflowId,
      type: WaitRequestType.WAIT,
      releaseSignalId: args.releaseSignalId,
    };
    const withClient = injector.resolve(Token.TemporalClient);
    await withClient(async (client) => {
      await client.workflow.signalWithStart(runWaitForWorkflow, {
        taskQueue: Context.current().info.taskQueue,
        workflowId: `wait-${args.workflow.id}`,
        args: [
          {
            workflow: args.workflow,
          },
        ],
        signal: waitRequestSignal,
        signalArgs: [req],
      });
    });
  };
