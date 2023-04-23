import {
  condition,
  continueAsNew,
  defineSignal,
  getExternalWorkflowHandle,
  proxyActivities,
  setHandler,
  workflowInfo,
  uuid4,
} from "@temporalio/workflow";

import type { Activities } from "~/agent/activities/list";
import type { LockRequest } from "~/agent/activities/mutex/shared";
import { currentWorkflowIdQuery, lockRequestSignal } from "~/agent/activities/mutex/shared";

const { signalWithStartLockWorkflow } = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
});

const MAX_WORKFLOW_HISTORY_LENGTH = 2000;

interface LockResponse {
  releaseSignalName: string;
}

export async function lockWorkflow(
  requests = Array<LockRequest>(),
  seenAcquireIds = new Set<string>(),
): Promise<void> {
  let currentWorkflowId: string | null = null;
  setHandler(lockRequestSignal, (req: LockRequest) => {
    if (seenAcquireIds.has(req.lockAcquiredSignalName)) {
      return;
    }
    seenAcquireIds.add(req.lockAcquiredSignalName);
    requests.push(req);
  });
  setHandler(currentWorkflowIdQuery, () => currentWorkflowId);
  while (workflowInfo().historyLength < MAX_WORKFLOW_HISTORY_LENGTH) {
    await condition(() => requests.length > 0);
    const req = requests.shift();
    // Check for `undefined` because otherwise TypeScript complains that `req`
    // may be undefined.
    if (req === undefined) {
      continue;
    }
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
    await workflowRequestingLock.signal(defineSignal<[LockResponse]>(req.lockAcquiredSignalName), {
      releaseSignalName,
    });

    // The lock is automatically released after `req.timeoutMs`, unless the
    // acquiring Workflow released it. This is to prevent deadlock.
    await condition(() => released, req.timeoutMs);
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
    lockTimeoutMs: number;
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
  await signalWithStartLockWorkflow(
    options.resourceId,
    lockAcquiredSignalName,
    options.lockTimeoutMs,
  );
  await condition(hasLock);

  await fn().finally(async () => {
    // Send a signal to the given lock Workflow to release the lock
    const handle = getExternalWorkflowHandle(options.resourceId);
    await handle.signal(releaseSignalName);
  });
}
