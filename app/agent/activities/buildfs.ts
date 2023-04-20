import { v4 as uuidv4 } from "uuid";

import type { CreateActivity } from "./types";
import { runActivityHeartbeat } from "./utils";

import { Token } from "~/token";

export type BuildfsActivity = (args: {
  buildfsEventId: bigint;
}) => Promise<{ buildSuccessful: boolean }>;
export const buildfs: CreateActivity<BuildfsActivity> =
  ({ injector, db }) =>
  async (args) => {
    const instanceId = `buildfs-${uuidv4()}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const buildfsService = injector.resolve(Token.BuildfsService);
    const perfService = injector.resolve(Token.PerfService);

    perfService.log("buildfs", "start", args.buildfsEventId);
    const result = await runActivityHeartbeat({ intervalMs: 5000 }, () =>
      buildfsService.buildfs({ ...args, db, firecrackerService }),
    );
    perfService.log("buildfs", "end", args.buildfsEventId);

    return result;
  };
