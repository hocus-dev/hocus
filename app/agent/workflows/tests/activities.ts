import type { Prisma } from "@prisma/client";

import { mutexTest } from "./mutex/activity";
import { cancellationTest } from "./wait-for-workflow/activity";

import type { Activities } from "~/agent/activities/list";
import { createActivities } from "~/agent/activities/list";
import type { AgentInjector } from "~/agent/agent-injector";

const testActivities = {
  cancellationTest,
  mutexTest,
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
