import { proxyActivities, ActivityCancellationType } from "@temporalio/workflow";

import type { TestActivities } from "~/agent/workflows/tests/activities";
import { withSharedWorkflow } from "~/agent/workflows/wait-for-workflow";

const { waitForWorkflowTestActivity } = proxyActivities<TestActivities>({
  startToCloseTimeout: "5 seconds",
  heartbeatTimeout: "1 second",
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
  retry: {
    maximumAttempts: 1,
  },
});

export async function innerWaitForWorkflowTest(): Promise<number> {
  return await waitForWorkflowTestActivity();
}

export async function runWaitForWorkflowTest(lockId: string): Promise<number> {
  return await withSharedWorkflow({
    lockId,
    workflow: innerWaitForWorkflowTest,
    params: [],
  });
}
