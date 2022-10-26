import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "./activities";

const { startFirecrackerInstance } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 1,
  },
});

export async function startVM(vmId: string): Promise<void> {
  await startFirecrackerInstance(vmId);
}
