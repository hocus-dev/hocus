import type { CheckoutAndInspectResult } from "../activities-types";
import { SOLO_AGENT_INSTANCE_ID } from "../constants";
import { randomString } from "../utils";

import type { CreateActivity } from "./types";
import { runActivityHeartbeat } from "./utils";

import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

/**
 * Copies the contents of `repositoryDrivePath` into `outputDrivePath`, and checks
 * out the given branch there.
 *
 * Returns an array of `ProjectConfig`s or `null`s corresponding to the
 * `projectConfigPaths` argument. If a hocus config file is not present in a directory,
 * `null` is returned.
 */
export type CheckoutAndInspectActivity = (args: {
  gitRepositoryId: bigint;
  /**
   * The repository will be checked out to this branch.
   */
  targetBranch: string;
  /**
   * A new drive will be created at this path.
   */
  outputDrivePath: string;
  /**
   * Relative paths to directories where `hocus.yml` files are located.
   */
  projectConfigPaths: string[];
}) => Promise<CheckoutAndInspectResult[]>;
export const checkoutAndInspect: CreateActivity<CheckoutAndInspectActivity> =
  ({ injector, db }) =>
  async (args) => {
    const instanceId = `checkout-and-inspect-${randomString(8)}`;
    const fcService = injector.resolve(Token.FirecrackerService)(instanceId);
    const prebuildService = injector.resolve(Token.PrebuildService);
    const perfService = injector.resolve(Token.PerfService);
    perfService.log("checkoutAndInspect", "start", args.gitRepositoryId, args.targetBranch);

    const result = await runActivityHeartbeat({ intervalMs: 5000 }, async () => {
      const gitRepository = await db.gitRepository.findUniqueOrThrow({
        where: { id: args.gitRepositoryId },
        include: {
          gitRepositoryFiles: { include: { agentInstance: true, file: true } },
        },
      });
      const repoFile = unwrap(
        gitRepository.gitRepositoryFiles.find(
          (f) => f.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
        ),
      );
      return await prebuildService.checkoutAndInspect({
        fcService,
        repositoryDrivePath: repoFile.file.path,
        targetBranch: args.targetBranch,
        outputDrivePath: args.outputDrivePath,
        projectConfigPaths: args.projectConfigPaths,
      });
    });

    perfService.log("checkoutAndInspect", "end", args.gitRepositoryId, args.targetBranch);
    return result;
  };
