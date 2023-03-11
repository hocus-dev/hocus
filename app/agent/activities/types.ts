import type { Prisma } from "@prisma/client";

import type { AgentInjector } from "../agent-injector";

export interface ActivityArgs {
  injector: AgentInjector;
  db: Prisma.NonTransactionClient;
}

export type CreateActivity<T> = (args: ActivityArgs) => T;
