/* eslint-disable no-console */
import {
  condition,
  continueAsNew,
  defineSignal,
  getExternalWorkflowHandle,
  proxyActivities,
  setHandler,
  workflowInfo,
  uuid4,
  CancellationScope,
} from "@temporalio/workflow";

import type { Activities } from "~/agent/activities/list";
import { LockRequest, wakeSignal } from "~/agent/activities/mutex/shared";
import { FINAL_WORKFLOW_EXECUTION_STATUS_NAMES } from "~/agent/activities/mutex/shared";
import { currentWorkflowIdQuery, lockRequestSignal } from "~/agent/activities/mutex/shared";
import { retryWorkflow } from "~/temporal/utils";

const { signalWithStartLockWorkflow, getWorkflowStatus } = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 10,
  },
});

const MAX_WORKFLOW_HISTORY_LENGTH = 2000;

interface LockResponse {
  releaseSignalName: string;
}

const WORKFLOW_EXECUTION_NOT_FOUND_ERR_TYPE = "ExternalWorkflowExecutionNotFound";

export async function lockWorkflow(
  requests = Array<LockRequest>(),
  seenAcquireIds = new Set<string>(),
): Promise<void> {
  let wake = false;
  const getWake = () => wake;
  let currentWorkflowId: string | null = null;

  setHandler(lockRequestSignal, (req: LockRequest) => {
    if (seenAcquireIds.has(req.lockAcquiredSignalName)) {
      return;
    }
    seenAcquireIds.add(req.lockAcquiredSignalName);
    requests.push(req);
  });
  setHandler(currentWorkflowIdQuery, () => currentWorkflowId);
  setHandler(wakeSignal, () => {
    // only used for testing
    wake = true;
  });

  while (workflowInfo().historyLength < MAX_WORKFLOW_HISTORY_LENGTH) {
    await condition(() => requests.length > 0, "10 minutes");
    if (requests.length === 0) {
      // timeout occurred
      return;
    }
    const req = requests.shift()!;
    currentWorkflowId = req.initiatorWorkflowId;
    const workflowRequestingLock = getExternalWorkflowHandle(req.initiatorWorkflowId);
    const releaseSignalName = uuid4();

    let released = false;
    setHandler(defineSignal(releaseSignalName), () => {
      released = true;
    });
    // Send a unique secret `releaseSignalName` to the Workflow that acquired
    // the lock. The acquiring Workflow should signal `releaseSignalName` to
    // release the lock.
    try {
      await retryWorkflow(
        () =>
          workflowRequestingLock.signal(defineSignal<[LockResponse]>(req.lockAcquiredSignalName), {
            releaseSignalName,
          }),
        {
          maxRetries: 10,
          retryIntervalMs: 250,
          maxRetryIntervalMs: 60 * 1000,
          isExponential: true,
          isRetriable: (err: any) => err?.type !== WORKFLOW_EXECUTION_NOT_FOUND_ERR_TYPE,
        },
      );
    } catch (err: any) {
      // If the workflow that acquired the lock has already completed or has been terminated,
      // the signal will fail with an error of type WORKFLOW_EXECUTION_NOT_FOUND_ERR_TYPE.
      // That's fine, we just ignore it. Otherwise, we log the error.
      if (err?.type !== WORKFLOW_EXECUTION_NOT_FOUND_ERR_TYPE) {
        console.error(
          `Cannot signal workflow with id ${workflowRequestingLock.workflowId} to acquire the lock. It it's still running, it will hang indefinitely.`,
          err,
        );
      }
      currentWorkflowId = null;
      continue;
    }

    const shouldWake = () => released || getWake();
    while (!released) {
      const workflowRequestingLockStatus = await getWorkflowStatus(req.initiatorWorkflowId).catch(
        (err) => console.warn(err),
      );
      if (FINAL_WORKFLOW_EXECUTION_STATUS_NAMES.includes(workflowRequestingLockStatus as any)) {
        // The workflow that acquired the lock has finished execution but did
        // not release the lock. This can happen if the Workflow was cancelled
        // or timed out. In this case, we release the lock and continue to prevent deadlock.
        break;
      }
      await condition(shouldWake, "30 seconds");
      wake = false;
      if (released) {
        break;
      }
    }
    currentWorkflowId = null;
  }
  // carry over any pending requests to the next execution
  if (requests.length > 0) {
    await continueAsNew<typeof lockWorkflow>(requests, seenAcquireIds);
  }
}

export async function withLock<T>(
  options: {
    resourceId: string;
  },
  fn: () => Promise<T>,
): Promise<void> {
  const lockAcquiredSignalName = `lock-acquired-${uuid4()}`;
  let releaseSignalName = "";
  setHandler(defineSignal<[LockResponse]>(lockAcquiredSignalName), (lockResponse: LockResponse) => {
    releaseSignalName = lockResponse.releaseSignalName;
  });
  const hasLock = () => releaseSignalName !== "";

  // Send a signal to the given lock Workflow to acquire the lock
  await signalWithStartLockWorkflow(options.resourceId, lockAcquiredSignalName);
  console.log("signalled", options.resourceId);
  await condition(hasLock);

  await fn().finally(async () => {
    console.log("considered cancelled", CancellationScope.current().consideredCancelled);
    await CancellationScope.nonCancellable(async () => {
      // Send a signal to the given lock Workflow to release the lock
      const handle = getExternalWorkflowHandle(options.resourceId);
      console.log("signalling release", releaseSignalName);
      try {
        await handle.signal(releaseSignalName);
      } catch (err) {
        console.warn(err);
        console.log("\n\n in catch block \n\n");
        throw err;
      } finally {
        console.log("wtf!!");
      }
      console.log("signalled release", releaseSignalName);
    });
  });
  console.log("exit");
}
