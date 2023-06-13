import { WorkspaceStatus } from "@prisma/client";

import type { CreateActivity } from "../types";

import { Token } from "~/token";

export type GetWorkspaceInstanceStatusActivity = (
  workspaceInstanceId: bigint,
) => Promise<"on" | "off" | "paused" | "removed">;
export const getWorkspaceInstanceStatus: CreateActivity<GetWorkspaceInstanceStatusActivity> =
  ({ injector, db }) =>
  async (workspaceInstanceId) => {
    const workspace = await db.workspace.findFirst({
      where: { activeInstanceId: workspaceInstanceId },
      include: {
        activeInstance: true,
      },
    });
    if (workspace == null || workspace.status === WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP) {
      return "removed";
    }
    if (workspace.activeInstance == null) {
      throw new Error("impossible");
    }
    const firecrackerService = injector.resolve(Token.FirecrackerService)(
      workspace.activeInstance.firecrackerInstanceId,
    );
    const vmInfo = await firecrackerService.getVMInfo();
    if (vmInfo == null) {
      return "off";
    }
    return vmInfo.status;
  };
