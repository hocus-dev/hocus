import { PrebuildEventReservationType, PrebuildEventStatus } from "@prisma/client";

import type { CreateActivity } from "../types";

export type MarkPrebuildEventAsArchivedActivity = (args: {
  prebuildEventId: bigint;
}) => Promise<void>;
export const markPrebuildEventAsArchived: CreateActivity<MarkPrebuildEventAsArchivedActivity> =
  ({ db }) =>
  async (args) => {
    await db.$transaction(async (tdb) => {
      const prebuildEvent = await tdb.prebuildEvent.findUniqueOrThrow({
        where: { id: args.prebuildEventId },
        include: {
          prebuildEventImages: true,
        },
      });
      if (prebuildEvent.status === PrebuildEventStatus.PREBUILD_EVENT_STATUS_ARCHIVED) {
        return;
      }
      await tdb.prebuildEventImages.deleteMany({
        where: { prebuildEventId: args.prebuildEventId },
      });
      await tdb.localOciImage.deleteMany({
        where: {
          id: {
            in: prebuildEvent.prebuildEventImages.flatMap((f) => [f.fsImageId, f.projectImageId]),
          },
        },
      });
      await tdb.prebuildEvent.update({
        where: { id: args.prebuildEventId },
        data: {
          status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_ARCHIVED,
        },
      });
      await tdb.prebuildEventReservation.deleteMany({
        where: {
          prebuildEventId: args.prebuildEventId,
          type: PrebuildEventReservationType.PREBUILD_EVENT_RESERVATION_TYPE_ARCHIVE_PREBUILD,
        },
      });
    });
  };
