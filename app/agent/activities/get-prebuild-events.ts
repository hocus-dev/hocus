import type { GitObject, GitRepository, PrebuildEvent, Project } from "@prisma/client";

import type { CreateActivity } from "./types";

export type GetPrebuildEventsActivity = (
  prebuildEventIds: bigint[],
) => Promise<
  (PrebuildEvent & { gitObject: GitObject; project: Project & { gitRepository: GitRepository } })[]
>;
export const getPrebuildEvents: CreateActivity<GetPrebuildEventsActivity> =
  ({ db }) =>
  async (prebuildEventIds) => {
    const prebuildEvents = await db.prebuildEvent.findMany({
      where: { id: { in: prebuildEventIds } },
      include: {
        gitObject: true,
        project: { include: { gitRepository: true } },
      },
    });
    if (prebuildEvents.length !== prebuildEventIds.length) {
      throw new Error("Some prebuild events were not found");
    }
    return prebuildEvents;
  };
