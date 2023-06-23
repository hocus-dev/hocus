import { v4 as uuidv4 } from "uuid";

import type { VMTaskOutput } from "../agent-util.types";
import type { ImageId } from "../block-registry/registry.service";
import { BlockRegistryService } from "../block-registry/registry.service";
import { SOLO_AGENT_INSTANCE_ID } from "../constants";

import type { CreateActivity } from "./types";
import { withActivityHeartbeat } from "./utils";

import { Token } from "~/token";
import { sha256 } from "~/utils.server";
import { unwrap } from "~/utils.shared";

export type PrebuildActivity = (args: {
  prebuildEventId: bigint;
  checkoutOutputId: string;
  tmpContentPrefix: string;
}) => Promise<VMTaskOutput[]>;
/**
 * Returns the result for every task.
 *
 * Assumes that there is a `hocus` user with passwordless sudo on the
 * filesystem drive, sshd is configured to start running automatically after VM boot,
 * and the corresponding public key to the private key used to connect to the VM
 * (`agentConfig.prebuildSshPrivateKey`) is already present in the `hocus` user's authorized_keys.
 */
export const prebuild: CreateActivity<PrebuildActivity> = ({ injector, db }) =>
  withActivityHeartbeat({ intervalMs: 5000 }, async (args) => {
    const runId = uuidv4();
    const instanceId = `prebuild-${runId}`;
    const runtime = injector.resolve(Token.QemuService)(instanceId);
    const prebuildService = injector.resolve(Token.PrebuildService);
    const brService = injector.resolve(Token.BlockRegistryService);
    const agentConfig = injector.resolve(Token.Config).agent();

    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: args.prebuildEventId },
      include: {
        tasks: {
          include: {
            vmTask: true,
          },
        },
        project: {
          include: {
            environmentVariableSet: {
              include: {
                environmentVariables: true,
              },
            },
          },
        },
        prebuildEventImages: {
          include: {
            agentInstance: true,
            fsImage: true,
            projectImage: true,
          },
        },
        buildfsEvent: {
          include: {
            buildfsEventImages: {
              include: {
                agentInstance: true,
                outputImage: true,
              },
            },
          },
        },
      },
    });
    const envVariables = prebuildEvent.project.environmentVariableSet.environmentVariables;
    const images = unwrap(
      prebuildEvent.prebuildEventImages.find(
        (pei) => pei.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    );
    let rootFsImageId: ImageId;
    if (prebuildEvent.buildfsEvent != null) {
      const buildfsImages = unwrap(
        prebuildEvent.buildfsEvent.buildfsEventImages.find(
          (bei) => bei.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
        ),
      );
      rootFsImageId = BlockRegistryService.genImageId(buildfsImages.outputImage.tag);
    } else {
      const defaultOutputId = sha256(
        agentConfig.defaultWorkspaceImageTag + "default-workspace-image",
      );
      rootFsImageId = BlockRegistryService.genImageId(defaultOutputId);
      if (!(await brService.hasContent(rootFsImageId))) {
        await brService.loadImageFromRemoteRepo(
          agentConfig.defaultWorkspaceImageTag,
          defaultOutputId,
        );
      }
    }
    const projectImageId = BlockRegistryService.genImageId(args.checkoutOutputId);

    return prebuildService.prebuild({
      db,
      runtime,
      tasks: prebuildEvent.tasks,
      envVariables,
      rootFsImageId,
      projectImageId,
      outputRootFsId: images.fsImage.tag,
      outputProjectId: images.projectImage.tag,
      memSizeMib: prebuildEvent.project.maxPrebuildRamMib,
      vcpuCount: prebuildEvent.project.maxPrebuildVCPUCount,
      tmpContentPrefix: args.tmpContentPrefix,
    });
  });
