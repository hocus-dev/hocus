import {
  proxyActivities,
  getExternalWorkflowHandle,
  setHandler,
  Trigger,
  CancellationScope,
  condition,
} from "@temporalio/workflow";

import type { TestActivities } from "../activities";

import { cancelLockSignal, isLockAcquiredQuery, releaseLockSignal } from "./shared";

import { withLock } from "~/agent/workflows/mutex";
import { waitForPromisesWorkflow } from "~/temporal/utils";

const { mutexTest } = proxyActivities<TestActivities>({
  startToCloseTimeout: "1 minute",
});

export async function testLock(): Promise<string[]> {
  const results: string[] = [];
  await withLock({ resourceId: "mutex-test-outer" }, async () => {
    await waitForPromisesWorkflow(
      Array.from({ length: 5 }).map((_, idx) =>
        withLock({ resourceId: "mutex-test-inner" }, async () => {
          results.push(`acquire-${idx}`);
          const result = await mutexTest();
          results.push(`result-${idx}-${result}`);
          results.push(`release-${idx}`);
        }),
      ),
    );
  });
  return results;
}

export async function signalWorkflow(workflowId: string, signalId: string): Promise<void> {
  const handle = await getExternalWorkflowHandle(workflowId);
  await handle.signal(signalId);
}

export async function acquireLockAndWaitForSignal(lockId: string): Promise<void> {
  const released = new Trigger<void>();
  let canceled = false;
  let lockAcquired = false;
  await setHandler(releaseLockSignal, () => {
    released.resolve();
  });
  await setHandler(cancelLockSignal, () => {
    canceled = true;
  });
  await setHandler(isLockAcquiredQuery, () => lockAcquired);
  await Promise.race([
    CancellationScope.nonCancellable(() => condition(() => canceled)),
    withLock({ resourceId: lockId }, async () => {
      lockAcquired = true;
      await released;
    }),
  ]);
}
