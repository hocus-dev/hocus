import type { CreateActivity } from "../types";
import { withActivityHeartbeat } from "../utils";

import { BlockRegistryService } from "~/agent/block-registry/registry.service";
import { SOLO_AGENT_INSTANCE_ID } from "~/agent/constants";
import { Token } from "~/token";
import { unwrap, waitForPromises } from "~/utils.shared";

export type DeleteLocalPrebuildEventFilesActivity = (args: {
  prebuildEventId: bigint;
}) => Promise<void>;
export const deleteLocalPrebuildEventFiles: CreateActivity<
  DeleteLocalPrebuildEventFilesActivity
> = ({ injector, db }) =>
  withActivityHeartbeat({ intervalMs: 1000 }, async (args) => {
    const brService = injector.resolve(Token.BlockRegistryService);
    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: args.prebuildEventId },
      include: {
        prebuildEventImages: {
          include: {
            agentInstance: true,
            fsImage: true,
            projectImage: true,
          },
        },
      },
    });
    const images = unwrap(
      prebuildEvent.prebuildEventImages.find(
        (f) => f.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    );
    await waitForPromises(
      [images.projectImage.tag, images.fsImage.tag]
        .map((tag) => BlockRegistryService.genImageId(tag))
        .map((imageId) => brService.removeContent(imageId)),
    );
    await brService.garbageCollect();
  });
