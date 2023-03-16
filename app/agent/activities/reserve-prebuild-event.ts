import type { PrebuildEventReservation, PrebuildEventReservationType } from "@prisma/client";
import { Token } from "~/token";

import type { CreateActivity } from "./types";

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
    return await db.$transaction((tdb) =>
      prebuildService.reservePrebuildEvent(
        tdb,
        args.prebuildEventId,
        args.reservationType,
        args.validUntil,
        args.reservationExternalId,
      ),
    );
  };
