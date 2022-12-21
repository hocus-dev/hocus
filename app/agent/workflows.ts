import { proxyActivities } from "@temporalio/workflow";

import type { createActivities } from "./activities";

const { checkoutAndInspect } = proxyActivities<Awaited<ReturnType<typeof createActivities>>>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 1,
  },
});

export async function spawnPrebuild(projectId: bigint, gitObjectId: bigint): Promise<void> {
  // todo
}
