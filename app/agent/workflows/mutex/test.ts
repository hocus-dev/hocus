import { uuid4, sleep } from "@temporalio/workflow";

import { withLock } from ".";

import { waitForPromisesWorkflow } from "~/temporal/utils";

export async function testLock(): Promise<string[]> {
  const resourceId = uuid4();
  const results: string[] = [];
  const cases = Array.from({ length: 8 }).map((_, idx) => idx);
  await waitForPromisesWorkflow(
    cases.map((idx) =>
      withLock({ resourceId, lockTimeoutMs: 5000 }, async () => {
        results.push(`acquire-${idx}`);
        await sleep(10);
        results.push(`release-${idx}`);
      }),
    ),
  );
  return results;
}
