import { proxyActivities } from "@temporalio/workflow";

import { withLock } from ".";

import type { Activities } from "~/agent/activities/list";
import { waitForPromisesWorkflow } from "~/temporal/utils";

const { mutexTest } = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
});

export async function testLock(): Promise<string[]> {
  const results: string[] = [];
  await withLock({ resourceId: "mutex-test-outer", lockTimeout: "1 hour" }, async () => {
    await waitForPromisesWorkflow(
      Array.from({ length: 5 }).map((_, idx) =>
        withLock({ resourceId: "mutex-test-inner", lockTimeout: "5 minutes" }, async () => {
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
