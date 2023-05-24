import type { PrebuildEvent } from "@prisma/client";
import { PrebuildEventStatus } from "@prisma/client";

import type { CreateActivity } from "./types";

import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

export type GetOrCreatePrebuildEventsActivity = (args: {
  projectId: bigint;
  gitObjectIds: bigint[];
}) => Promise<{
  found: PrebuildEvent[];
  created: PrebuildEvent[];
}>;

export const getOrCreatePrebuildEvents: CreateActivity<GetOrCreatePrebuildEventsActivity> =
  ({ injector, db }) =>
  async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const gitObjectIds = args.gitObjectIds;
    if (new Set(gitObjectIds).size !== gitObjectIds.length) {
      throw new Error("git object ids must be unique");
    }
    const found = await db.prebuildEvent.findMany({
      where: {
        projectId: args.projectId,
        gitObjectId: { in: gitObjectIds },
        status: {
          notIn: [
            PrebuildEventStatus.PREBUILD_EVENT_STATUS_ARCHIVED,
            PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_ARCHIVE,
            PrebuildEventStatus.PREBUILD_EVENT_STATUS_CANCELLED,
            PrebuildEventStatus.PREBUILD_EVENT_STATUS_ERROR,
          ],
        },
      },
    });
    const foundEventsByGitObjectId = new Map(found.map((event) => [event.gitObjectId, event]));
    const argsToCreate = gitObjectIds.filter(
      (gitObjectId) => !foundEventsByGitObjectId.has(gitObjectId),
    );
    const created = await db.$transaction((tdb) =>
      waitForPromises(
        argsToCreate.map((gitObjectId) =>
          prebuildService.createPrebuildEvent(tdb, {
            projectId: args.projectId,
            gitObjectId,
          }),
        ),
      ),
    );
    return {
      found,
      created,
    };
  };
