/* eslint-disable no-console */
import assert from "assert";

import {
  condition,
  getExternalWorkflowHandle,
  setHandler,
  startChild,
  ParentClosePolicy,
  Trigger,
  proxyActivities,
  uuid4,
  isCancellation,
  defineSignal,
} from "@temporalio/workflow";

import type { Activities } from "~/agent/activities/list";
import type { AwaitableWorkflows, WaitRequest } from "~/agent/activities/wait-for-workflow/shared";
import { WorkflowCancelledError } from "~/agent/activities/wait-for-workflow/shared";
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

export interface WithSharedWorkflowParams<K extends keyof Workflows> {
  /** Workflows continue execution after this workflow finishes running. Should be idempotent. */
  workflow: {
    id: string;
    name: K;
    params: Parameters<Workflows[K]>;
  };
}

export async function runWaitForWorkflow<K extends keyof Workflows>(
  args: WithSharedWorkflowParams<K>,
): Promise<void> {
  const { workflow } = args;
  const requests: WaitRequest[] = [];

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
    if (cancelled >= requests.length) {
      cancelledTrigger.resolve("cancelled");
    }
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
  }
  const finalResult: GetWorkflowResult =
    result === "cancelled" ? { ok: false, error: new WorkflowCancelledError() } : result;

  while (requests.length > 0) {
    const req = requests.shift()!;
    if (req.type === WaitRequestType.CANCEL) {
      continue;
    }
    const handle = getExternalWorkflowHandle(req.initiatorWorkflowId);
    await handle.signal(req.releaseSignalId, finalResult);
  }
}

type WorkflowResults = {
  [K in keyof Workflows]: Awaited<ReturnType<Workflows[K]>>;
};

export async function withSharedWorkflow<K extends keyof Workflows>(
  args: WithSharedWorkflowParams<K>,
): Promise<WorkflowResults[K]> {
  const releaseSignalId = uuid4();
  const releaseSignal = defineSignal<[GetWorkflowResult]>(releaseSignalId);
  let workflowResult: undefined | GetWorkflowResult;
  setHandler(releaseSignal, (result) => {
    workflowResult = result;
  });

  try {
    await signalWithStartWaitWorkflow({
      ...args,
      releaseSignalId,
      waitRequestType: WaitRequestType.WAIT,
    });
    await condition(() => workflowResult !== void 0);
  } catch (err) {
    if (isCancellation(err)) {
      await signalWithStartWaitWorkflow({
        ...args,
        releaseSignalId,
        waitRequestType: WaitRequestType.CANCEL,
      });
      throw err;
    }
  }

  assert(workflowResult !== void 0);
  if (workflowResult.ok) {
    return workflowResult.result as WorkflowResults[K];
  } else {
    throw wrapWorkflowError(workflowResult.error);
  }
}
