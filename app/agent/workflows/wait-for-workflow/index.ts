/* eslint-disable no-console */
import assert from "assert";

import {
  condition,
  getExternalWorkflowHandle,
  setHandler,
  startChild,
  executeChild,
  ParentClosePolicy,
  Trigger,
  proxyActivities,
  uuid4,
  defineSignal,
} from "@temporalio/workflow";

import type { Activities } from "~/agent/activities/list";
import type {
  AwaitableWorkflows,
  FinishedExecutionRequest,
  WaitRequest,
} from "~/agent/activities/wait-for-workflow/shared";
import { finishedExecutionSignal } from "~/agent/activities/wait-for-workflow/shared";
import { WaitRequestType } from "~/agent/activities/wait-for-workflow/shared";
import { waitRequestSignal } from "~/agent/activities/wait-for-workflow/shared";
import { wrapWorkflowError } from "~/temporal/utils";

type Workflows = AwaitableWorkflows;
type GetWorkflowResult =
  | { ok: true; result: unknown; error?: undefined }
  | { ok: false; result?: undefined; error: unknown };

const { signalWithStartWaitWorkflow } = proxyActivities<Activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    maximumAttempts: 10,
  },
});

export interface WithSharedWorkflowParams<K extends keyof Workflows, L extends keyof Workflows> {
  /** Workflows continue execution after this workflow finishes running */
  workflow: {
    id: string;
    name: K;
    params: Parameters<Workflows[K]>;
  };
  /** Executed after `completeThreshold` waiting workflows finish running withSharedWorkflow */
  postWorkflow: {
    id: string;
    name: L;
    params: Parameters<Workflows[L]>;
  };
  /**
   * Number of workflows that must be cancelled before the workflow is considered cancelled.
   * Also used as the number of workflows that must finish before the postWorkflow is executed.
   */
  completeThreshold: number;
}

export async function runWaitForWorkflow<K extends keyof Workflows, L extends keyof Workflows>(
  args: WithSharedWorkflowParams<K, L>,
): Promise<void> {
  const { workflow, postWorkflow, completeThreshold } = args;
  const requests: WaitRequest[] = [];
  const finishedWorkflowIds = new Set<string>();

  const cancelledTrigger = new Trigger<"cancelled">();
  let cancelled = 0;
  setHandler(waitRequestSignal, (req: WaitRequest) => {
    const idx = requests.findIndex((e) => e.releaseSignalId === req.releaseSignalId);
    if (idx >= 0 && requests[idx].releaseSignalId === WaitRequestType.CANCEL) {
      return;
    }
    if (req.type === WaitRequestType.CANCEL) {
      cancelled++;
    }
    if (idx >= 0) {
      requests[idx] = req;
    } else {
      requests.push(req);
    }
    if (cancelled >= completeThreshold) {
      cancelledTrigger.resolve("cancelled");
    }
  });
  setHandler(finishedExecutionSignal, (req: FinishedExecutionRequest) => {
    finishedWorkflowIds.add(req.initiatorWorkflowId);
  });
  const handle = await startChild(workflow.name, {
    args: workflow.params as any,
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    workflowId: workflow.id,
  });
  const result: GetWorkflowResult | "cancelled" = await Promise.race([
    cancelledTrigger,
    handle
      .result()
      .then((result) => ({
        ok: true as const,
        result,
      }))
      .catch((error) => ({
        ok: false as const,
        error,
      })),
  ]);
  if (result === "cancelled") {
    const externalHandle = getExternalWorkflowHandle(workflow.id);
    await externalHandle.cancel().catch((err) => {
      console.warn(`Failed to cancel workflow with id ${workflow.id}`, err);
    });
    // all wait requests are cancelled, so we don't need to signal anything else
    return;
  }
  let signalled = 0;
  while (signalled < completeThreshold) {
    await condition(() => requests.length > 0);
    const req = requests.shift()!;
    signalled += 1;
    if (req.type === WaitRequestType.CANCEL) {
      continue;
    }
    const handle = getExternalWorkflowHandle(req.initiatorWorkflowId);
    await handle.signal(req.releaseSignalId, result);
  }
  await condition(() => finishedWorkflowIds.size >= completeThreshold);
  await executeChild(postWorkflow.name, {
    args: postWorkflow.params as any,
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    workflowId: postWorkflow.id,
  }).catch((err) => console.warn(`Failed to execute post workflow ${postWorkflow.id}`, err));
}

type WorkflowResults = {
  [K in keyof Workflows]: Awaited<ReturnType<Workflows[K]>>;
};

export async function withSharedWorkflow<K extends keyof Workflows, L extends keyof Workflows>(
  args: WithSharedWorkflowParams<K, L>,
  fn: (workflowResult: WorkflowResults[K]) => Promise<void>,
): Promise<void> {
  const releaseSignalId = uuid4();
  const releaseSignal = defineSignal<[GetWorkflowResult]>(releaseSignalId);
  let workflowResult: undefined | GetWorkflowResult;
  setHandler(releaseSignal, (result) => {
    workflowResult = result;
  });
  // TODO: handle cancellation
  await signalWithStartWaitWorkflow({ ...args, releaseSignalId });

  await condition(() => workflowResult !== void 0);
  assert(workflowResult !== void 0);

  try {
    if (workflowResult.ok) {
      return await fn(workflowResult?.result as WorkflowResults[K]);
    } else {
      throw wrapWorkflowError(workflowResult.error);
    }
  } finally {
    // TODO: signal that we're done
  }
}
