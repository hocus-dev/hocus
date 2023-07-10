import type { CreateActivity } from "../types";
import { withActivityHeartbeat } from "../utils";

import { removeContentWithPrefix as removeContentWithPrefixUtil } from "~/agent/block-registry/utils";
import { Token } from "~/token";

export type RemoveContentWithPrefixActivity = (args: { prefix: string }) => Promise<void>;
export const removeContentWithPrefix: CreateActivity<RemoveContentWithPrefixActivity> = ({
  injector,
}) =>
  withActivityHeartbeat({ intervalMs: 1000 }, async (args) => {
    const brService = injector.resolve(Token.BlockRegistryService);
    await removeContentWithPrefixUtil(brService, args.prefix);
    await brService.garbageCollect();
  });
