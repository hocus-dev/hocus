import { PrebuildEventReservationType } from "@prisma/client";

import type { CreateActivity } from "../types";

import { sleep } from "~/utils.shared";

export type WaitForPrebuildEventReservationsActivity = (args: {
  prebuildEventId: bigint;
  timeoutMs: number;
}) => Promise<void>;
export const waitForPrebuildEventReservations: CreateActivity<
  WaitForPrebuildEventReservationsActivity
> =
  ({ db }) =>
  async (args) => {
    const start = Date.now();
    while (true) {
      const now = new Date();
      if (now.getTime() - start > args.timeoutMs) {
        throw new Error("Timed out waiting for prebuild event reservations");
      }
      const reservations = await db.prebuildEventReservation.findMany({
        where: {
          prebuildEventId: args.prebuildEventId,
          validUntil: { gt: now },
        },
      });
      const archivePrebuildReservation = reservations.find(
        (r) =>
          r.type === PrebuildEventReservationType.PREBUILD_EVENT_RESERVATION_TYPE_ARCHIVE_PREBUILD,
      );
      if (reservations.length === 1 && archivePrebuildReservation !== void 0) {
        return;
      } else if (archivePrebuildReservation === void 0) {
        throw new Error("No prebuild event reservations found");
      }
      await sleep(2000);
    }
  };
