import { proxyActivities, ActivityCancellationType } from "@temporalio/workflow";

import { withSharedWorkflow } from "~/agent/workflows/shared-workflow";
import type { TestActivities } from "~/agent/workflows/tests/activities";

const { sharedWorkflowTestActivity } = proxyActivities<TestActivities>({
  startToCloseTimeout: "5 seconds",
  heartbeatTimeout: "1 second",
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
  retry: {
    maximumAttempts: 1,
  },
});

export async function innerSharedWorkflowTest(): Promise<number> {
  return await sharedWorkflowTestActivity();
}

export async function runSharedWorkflowTest(lockId: string): Promise<number> {
  return await withSharedWorkflow({
    lockId,
    workflow: innerSharedWorkflowTest,
    params: [],
  });
}
