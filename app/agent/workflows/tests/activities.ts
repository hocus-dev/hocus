import type { Prisma } from "@prisma/client";

import { cancellationTest } from "./cancellation-experiments/activity";
import { mutexTest } from "./mutex/activity";
import { waitForWorkflowTestActivity } from "./wait-for-workflow/activity";

import type { Activities } from "~/agent/activities/list";
import { createActivities } from "~/agent/activities/list";
import type { AgentInjector } from "~/agent/agent-injector";

const testActivities = {
  cancellationTest,
  mutexTest,
  waitForWorkflowTestActivity,
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
