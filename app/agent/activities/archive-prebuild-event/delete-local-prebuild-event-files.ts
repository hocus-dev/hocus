import type { CreateActivity } from "../types";

import { SOLO_AGENT_INSTANCE_ID } from "~/agent/constants";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export type DeleteLocalPrebuildEventFilesActivity = (args: {
  prebuildEventId: bigint;
}) => Promise<void>;
export const deleteLocalPrebuildEventFiles: CreateActivity<DeleteLocalPrebuildEventFilesActivity> =
  ({ injector, db }) =>
  async (args) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: args.prebuildEventId },
      include: {
        prebuildEventFiles: {
          include: {
            agentInstance: true,
            fsFile: true,
            projectFile: true,
          },
        },
      },
    });
    const files = unwrap(
      prebuildEvent.prebuildEventFiles.find(
        (f) => f.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    );
    await prebuildService.removeLocalPrebuildEventFiles({
      fsDrivePath: files.fsFile.path,
      projectDrivePath: files.projectFile.path,
    });
  };
