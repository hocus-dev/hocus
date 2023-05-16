import {
  proxyActivities,
  isCancellation,
  CancellationScope,
  ActivityCancellationType,
} from "@temporalio/workflow";

import type { TestActivities } from "~/agent/workflows/tests/activities";

const { cancellationTest } = proxyActivities<TestActivities>({
  startToCloseTimeout: "600 seconds",
  heartbeatTimeout: "1 second",
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
  retry: {
    maximumAttempts: 10,
  },
});

export async function cancellationTestWorkflow(): Promise<string[]> {
  const result: string[] = [];
  const result1 = await cancellationTest("1");
  result.push(result1);
  try {
    const result2 = await cancellationTest("2");
    result.push(result2);
  } catch (err) {
    if (isCancellation(err)) {
      result.push("cancelled");
    } else {
      throw err;
    }
  }
  await CancellationScope.nonCancellable(async () => {
    const result3 = await cancellationTest("3");
    result.push(result3);
  });
  try {
    const result4 = await cancellationTest("4");
    result.push(result4);
  } catch (err) {
    if (isCancellation(err)) {
      result.push("cancelled");
    } else {
      throw err;
    }
  }
  return result;
}
