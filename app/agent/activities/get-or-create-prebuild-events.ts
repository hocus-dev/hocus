import type { PrebuildEvent } from "@prisma/client";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

import type { CreateActivity } from "./types";

export type GetOrCreatePrebuildEventsActivity = (args: {
  projectId: bigint;
  git: {
    /** must be unique within the `git` array */
    objectId: bigint;
    branchIds: bigint[];
  }[];
}) => Promise<{
  found: PrebuildEvent[];
  created: PrebuildEvent[];
}>;

export const getOrCreatePrebuildEvents: CreateActivity<GetOrCreatePrebuildEventsActivity> =
  ({ injector, db }) =>
  async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const gitObjectIds = args.git.map((arg) => arg.objectId);
    if (new Set(gitObjectIds).size !== gitObjectIds.length) {
      throw new Error("git object ids must be unique");
    }
    const found = await db.prebuildEvent.findMany({
      where: {
        projectId: args.projectId,
        gitObjectId: { in: gitObjectIds },
      },
    });
    const foundEventsByGitObjectId = new Map(found.map((event) => [event.gitObjectId, event]));
    const argsToCreate = args.git.filter((arg) => !foundEventsByGitObjectId.has(arg.objectId));
    const created = await db.$transaction((tdb) =>
      waitForPromises(
        argsToCreate.map((arg) =>
          prebuildService.createPrebuildEvent(tdb, {
            projectId: args.projectId,
            gitObjectId: arg.objectId,
            gitBranchIds: arg.branchIds,
          }),
        ),
      ),
    );
    return {
      found,
      created,
    };
  };
