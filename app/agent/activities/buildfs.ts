import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";

import type { CreateActivity } from "./types";

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
    const result = await buildfsService.buildfs({ ...args, db, firecrackerService });
    perfService.log("buildfs", "end", args.buildfsEventId);

    return result;
  };
