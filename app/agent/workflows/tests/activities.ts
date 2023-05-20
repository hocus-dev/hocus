import type { Prisma } from "@prisma/client";

import { cancellationTest } from "./cancellation-experiments/activity";
import { mutexTest } from "./mutex/activity";
import { sharedWorkflowTestActivity } from "./shared-workflow/activity";

import type { Activities } from "~/agent/activities/list";
import { createActivities } from "~/agent/activities/list";
import type { AgentInjector } from "~/agent/agent-injector";

const testActivities = {
  cancellationTest,
  mutexTest,
  sharedWorkflowTestActivity,
} as const;

export type TestActivities = Activities & typeof testActivities;

export const createTestActivities = async (
  injector: AgentInjector,
  db: Prisma.NonTransactionClient,
): Promise<TestActivities> => {
  const activities = await createActivities(injector, db);

  return {
    ...activities,
    ...testActivities,
  };
};
