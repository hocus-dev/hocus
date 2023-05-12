/* eslint-disable no-console */
import {
  condition,
  getExternalWorkflowHandle,
  setHandler,
  startChild,
  ParentClosePolicy,
  Trigger,
} from "@temporalio/workflow";

import type { WaitRequest } from "~/agent/activities/wait-for-workflow/shared";
import { WaitRequestType } from "~/agent/activities/wait-for-workflow/shared";
import { waitRequestSignal } from "~/agent/activities/wait-for-workflow/shared";
import type * as WorkflowsObject from "~/agent/workflows";

type Workflows = Omit<typeof WorkflowsObject, "runWaitForWorkflow">;

type GetWorkflowResult =
  | { ok: true; result: unknown; error?: undefined }
  | { ok: false; result?: undefined; error: unknown };

export async function runWaitForWorkflow<K extends keyof Workflows>(
  workflow: {
    id: string;
    name: K;
    params: Parameters<Workflows[K]>;
  },
  requests = Array<WaitRequest>(),
  completeThreshold: number,
): Promise<void> {
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
}
