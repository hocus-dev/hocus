import type { PrebuildEventReservation } from "@prisma/client";
import { PrebuildEventReservationType, PrebuildEventStatus } from "@prisma/client";

import type { CreateActivity } from "../types";

import { Token } from "~/token";

export type ReservePrebuildEventActivity = (args: {
  prebuildEventId: bigint;
  reservationType: PrebuildEventReservationType;
  reservationExternalId?: string;
  validUntil: Date;
}) => Promise<PrebuildEventReservation>;
export const reservePrebuildEvent: CreateActivity<ReservePrebuildEventActivity> =
  ({ injector, db }) =>
  async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    return await db.$transaction(async (tdb) => {
      const reservation = await prebuildService.reservePrebuildEvent(
        tdb,
        args.prebuildEventId,
        args.reservationType,
        args.validUntil,
        args.reservationExternalId,
      );
      if (
        args.reservationType ===
        PrebuildEventReservationType.PREBUILD_EVENT_RESERVATION_TYPE_ARCHIVE_PREBUILD
      ) {
        await db.prebuildEvent.update({
          where: { id: args.prebuildEventId },
          data: { status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_ARCHIVE },
        });
      }
      return reservation;
    });
  };
