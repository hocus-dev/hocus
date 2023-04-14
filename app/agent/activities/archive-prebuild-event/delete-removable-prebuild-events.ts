import type { CreateActivity } from "../types";

import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

export type DeleteRemovablePrebuildEventsActivity = (projectId: bigint) => Promise<void>;
export const deleteRemovablePrebuildEvents: CreateActivity<DeleteRemovablePrebuildEventsActivity> =
  ({ db, injector }) =>
  async (projectId) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    await db.$transaction(async (tdb) => {
      const removablePrebuildEvents = await prebuildService.getRemovablePrebuildEvents(
        tdb,
        projectId,
        new Date(),
      );
      await waitForPromises(
        removablePrebuildEvents.map((e) => prebuildService.removePrebuildEventFromDb(tdb, e.id)),
      );
    });
  };
