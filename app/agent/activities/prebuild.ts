import { v4 as uuidv4 } from "uuid";

import type { VMTaskOutput } from "../agent-util.types";

import type { CreateActivity } from "./types";
import { runActivityHeartbeat } from "./utils";

import { Token } from "~/token";

export type PrebuildActivity = (args: { prebuildEventId: bigint }) => Promise<VMTaskOutput[]>;
/**
 * Returns the result for every task.
 *
 * Assumes that there is a `hocus` user with passwordless sudo on the
 * filesystem drive, sshd is configured to start running automatically after VM boot,
 * and the corresponding public key to the private key used to connect to the VM
 * (`agentConfig.prebuildSshPrivateKey`) is already present in the `hocus` user's authorized_keys.
 */
export const prebuild: CreateActivity<PrebuildActivity> =
  ({ injector, db }) =>
  async (args) => {
    const runId = uuidv4();
    const instanceId = `prebuild-${runId}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const prebuildService = injector.resolve(Token.PrebuildService);

    return await runActivityHeartbeat({ intervalMs: 5000 }, () =>
      prebuildService.prebuild(db, firecrackerService, args.prebuildEventId),
    );
  };
