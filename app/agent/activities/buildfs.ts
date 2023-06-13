import { VmTaskStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { BlockRegistryService } from "../block-registry/registry.service";
import { SOLO_AGENT_INSTANCE_ID } from "../constants";

import type { CreateActivity } from "./types";
import { withActivityHeartbeat } from "./utils";

import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export type BuildfsActivity = (args: {
  buildfsEventId: bigint;
  checkoutOutputId: string;
}) => Promise<{ buildSuccessful: boolean; error?: string }>;
export const buildfs: CreateActivity<BuildfsActivity> = ({ injector, db }) =>
  withActivityHeartbeat({ intervalMs: 5000 }, async (args) => {
    const instanceId = `buildfs-${uuidv4()}`;
    const runtime = injector.resolve(Token.QemuService)(instanceId);
    const buildfsService = injector.resolve(Token.BuildfsService);
    const perfService = injector.resolve(Token.PerfService);

    const buildfsEvent = await db.buildfsEvent.findUniqueOrThrow({
      where: { id: args.buildfsEventId },
      include: {
        vmTask: true,
        project: true,
        buildfsEventImages: {
          include: {
            agentInstance: true,
            outputImage: true,
          },
        },
      },
    });
    const outputImage = unwrap(
      buildfsEvent.buildfsEventImages.find(
        (i) => i.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    ).outputImage;
    const status = buildfsEvent.vmTask.status;
    if (status === VmTaskStatus.VM_TASK_STATUS_SUCCESS) {
      return { buildSuccessful: true };
    }
    if (
      [VmTaskStatus.VM_TASK_STATUS_ERROR, VmTaskStatus.VM_TASK_STATUS_CANCELLED].includes(
        status as any,
      )
    ) {
      return { buildSuccessful: false, error: `Buildfs vm task status: ${status}` };
    }
    const repoImageId = BlockRegistryService.genImageId(args.checkoutOutputId);

    perfService.log("buildfs", "start", args.buildfsEventId);
    const result = await buildfsService.buildfs({
      db,
      runtime,
      vmTaskId: buildfsEvent.vmTaskId,
      memSizeMib: buildfsEvent.project.maxPrebuildRamMib,
      vcpuCount: buildfsEvent.project.maxPrebuildVCPUCount,
      repoImageId,
      outputId: outputImage.tag,
    });
    perfService.log("buildfs", "end", args.buildfsEventId);

    return result;
  });
