import {
  proxyActivities,
  isCancellation,
  CancellationScope,
  ActivityCancellationType,
} from "@temporalio/workflow";

import type { TestActivities } from "~/agent/workflows/tests/activities";

const { cancellationTest } = proxyActivities<TestActivities>({
  startToCloseTimeout: "600 seconds",
  heartbeatTimeout: "1 seconds",
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
  retry: {
    maximumAttempts: 1,
  },
});

export async function cancellationTestWorkflow(): Promise<void> {
  console.log("🎉 New Start ⭐️   ");
  console.log("result", await cancellationTest("1"));
  try {
    console.log("result", await cancellationTest("2"));
  } catch (err) {
    if (isCancellation(err)) {
      console.log("Cancelled error caught");
      CancellationScope.current().cancel();
      // throw wrapWorkflowError(err);
    } else {
      throw err;
    }
  }
  console.log("gonna run 3");
  await CancellationScope.nonCancellable(async () => {
    console.log("result", await cancellationTest("3"));
  });
}
