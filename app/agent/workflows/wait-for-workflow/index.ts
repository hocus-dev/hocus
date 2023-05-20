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
  CancellationScope,
} from "@temporalio/workflow";

import type { Activities } from "~/agent/activities/list";
import type { WaitRequest } from "~/agent/activities/shared-workflow/shared";
import { sharedWorkflowIdQuery } from "~/agent/activities/shared-workflow/shared";
import { requestsQuery } from "~/agent/activities/shared-workflow/shared";
import { WorkflowCancelledError } from "~/agent/activities/shared-workflow/shared";
import { WaitRequestType } from "~/agent/activities/shared-workflow/shared";
import { waitRequestSignal } from "~/agent/activities/shared-workflow/shared";
import { retrySignal } from "~/agent/workflows-utils";
import { wrapWorkflowError } from "~/temporal/utils";

type GetWorkflowResult =
  | { ok: true; result: unknown; error?: undefined }
  | { ok: false; result?: undefined; error: unknown };

const { signalWithStartWaitWorkflow } = proxyActivities<Activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    maximumAttempts: 10,
  },
});

export async function runWaitForWorkflow(args: {
  workflow: string;
  params: unknown[];
}): Promise<void> {
  const requests: WaitRequest[] = [];
  const workflowId = uuid4();
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
  setHandler(requestsQuery, () => requests);
  setHandler(sharedWorkflowIdQuery, () => workflowId);
  let result: GetWorkflowResult = {
    ok: false,
    error: new Error("Unknown shared workflow error"),
  };
  try {
    const handle = await startChild(args.workflow, {
      args: args.params as any,
      parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
      workflowId,
    });
    const partialResult = await Promise.race([
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
    if (partialResult === "cancelled") {
      const externalHandle = getExternalWorkflowHandle(workflowId);
      await externalHandle.cancel().catch((err) => {
        console.warn(`Failed to cancel workflow with id ${workflowId}`, err);
      });
    }
    result =
      partialResult === "cancelled"
        ? { ok: false, error: new WorkflowCancelledError() }
        : partialResult;
  } catch (error) {
    result = { ok: false, error };
  } finally {
    while (requests.length > 0) {
      const req = requests.shift()!;
      if (req.type === WaitRequestType.CANCEL) {
        continue;
      }
      const handle = getExternalWorkflowHandle(req.initiatorWorkflowId);
      await retrySignal(() => handle.signal(req.releaseSignalId, result)).catch((err) =>
        console.warn(`Failed to release workflow ${req.initiatorWorkflowId}`, err),
      );
    }
  }
}

export async function withSharedWorkflow<W extends (...args: any[]) => Promise<any>>(args: {
  lockId: string;
  workflow: W;
  params: Parameters<W>;
}): Promise<Awaited<ReturnType<W>>> {
  const releaseSignalId = uuid4();
  const releaseSignal = defineSignal<[GetWorkflowResult]>(releaseSignalId);
  let workflowResult: undefined | GetWorkflowResult;
  setHandler(releaseSignal, (result) => {
    workflowResult = result;
  });

  const signalParams = {
    releaseSignalId,
    lockId: args.lockId,
    workflow: args.workflow.name,
    params: args.params,
  };
  try {
    await signalWithStartWaitWorkflow({
      ...signalParams,
      waitRequestType: WaitRequestType.WAIT,
    });
    await condition(() => workflowResult !== void 0);
  } catch (err) {
    await CancellationScope.nonCancellable(async () => {
      if (isCancellation(err)) {
        await signalWithStartWaitWorkflow({
          ...signalParams,
          waitRequestType: WaitRequestType.CANCEL,
        }).catch((err) => console.warn("Failed to signal that the workflow is cancelled", err));
      }
    });
    throw err;
  }

  assert(workflowResult !== void 0);
  if (workflowResult.ok) {
    return workflowResult.result as Awaited<ReturnType<W>>;
  } else {
    throw wrapWorkflowError(workflowResult.error);
  }
}
