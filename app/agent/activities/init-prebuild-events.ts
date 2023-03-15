import type { PrebuildEvent } from "@prisma/client";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

import type { CreateActivity } from "./types";

export type InitPrebuildEventsActivity = (
  args: {
    prebuildEventId: bigint;
    buildfsEventId: bigint | null;
    tasks: { command: string; cwd: string }[];
    workspaceTasks: { command: string; commandShell: string }[];
  }[],
) => Promise<PrebuildEvent[]>;

export const initPrebuildEvents: CreateActivity<InitPrebuildEventsActivity> =
  ({ injector, db }) =>
  async (args): Promise<PrebuildEvent[]> => {
    const prebuildService = injector.resolve(Token.PrebuildService);

    return await db.$transaction(async (tdb) => {
      return await waitForPromises(args.map((arg) => prebuildService.initPrebuildEvent(tdb, arg)));
    });
  };
