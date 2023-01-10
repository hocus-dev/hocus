import fs from "fs/promises";
import path from "path";

import type { Prisma } from "@prisma/client";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import type { AgentUtilService } from "./agent-util.service";

export class WorkspaceAgentService {
  static inject = [Token.AgentUtilService] as const;

  constructor(private readonly agentUtilService: AgentUtilService) {}

  async createWorkspaceFiles(db: Prisma.Client, workspaceId: bigint): Promise<void> {
    const workspace = await db.workspace.findUniqueOrThrow({
      where: {
        id: workspaceId,
      },
      include: {
        rootFsFile: true,
        projectFile: true,
        prebuildEvent: {
          include: {
            prebuildEventFiles: {
              include: {
                projectFile: true,
                fsFile: true,
              },
            },
          },
        },
      },
    });

    const prebuildEventFiles = unwrap(
      workspace.prebuildEvent.prebuildEventFiles.find(
        (f) => f.agentInstanceId === workspace.agentInstanceId,
      ),
    );

    await Promise.all(
      [workspace.projectFile, workspace.rootFsFile]
        .map((f) => path.dirname(f.path))
        .map((dir) => fs.mkdir(dir, { recursive: true })),
    );
    await fs.copyFile(prebuildEventFiles.fsFile.path, workspace.rootFsFile.path);
    await fs.copyFile(prebuildEventFiles.projectFile.path, workspace.projectFile.path);

    await this.agentUtilService.expandDriveImage(workspace.rootFsFile.path, 50000);
    await this.agentUtilService.expandDriveImage(workspace.projectFile.path, 50000);
  }
}
