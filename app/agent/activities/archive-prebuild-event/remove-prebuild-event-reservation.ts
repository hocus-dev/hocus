import type { CreateActivity } from "../types";

export type RemovePrebuildEventReservationActivity = (
  reservationExternalId: string,
) => Promise<void>;
export const removePrebuildEventReservation: CreateActivity<
  RemovePrebuildEventReservationActivity
> =
  ({ db }) =>
  async (reservationExternalId) => {
    await db.prebuildEventReservation.delete({
      where: {
        externalId: reservationExternalId,
      },
    });
  };
