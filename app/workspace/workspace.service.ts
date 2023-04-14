import type { Prisma, WorkspaceStatus } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";
import type { Config as NameGeneratorConfig } from "unique-names-generator";

import type { Config } from "~/config";
import { HttpError } from "~/http-error.server";
import { Token } from "~/token";
import { formatBranchName } from "~/utils.shared";

export interface WorkspaceInfo {
  status: WorkspaceStatus;
  externalId: string;
  name: string;
  branchName: string;
  commitHash: string;
  project: {
    externalId: string;
    name: string;
    rootDirectoryPath: string;
  };
  agentHostname: string;
  workspaceHostname?: string;
  lastOpenedAt: number;
  createdAt: number;
}
export class WorkspaceService {
  private readonly agentHostname: string;
  static inject = [Token.Config] as const;
  constructor(config: Config) {
    this.agentHostname = config.controlPlane().agentHostname;
  }

  private nameGeneratorConfig: NameGeneratorConfig = {
    dictionaries: [adjectives, animals],
    length: 2,
    separator: " ",
    style: "capital",
  };

  generateWorkspaceName(): string {
    return uniqueNamesGenerator(this.nameGeneratorConfig);
  }

  /**
   * Returns `null` if the workspace does not exist.
   */
  async getWorkspaceInfo(
    db: Prisma.Client,
    requestingUserId: bigint,
    externalId: string,
  ): Promise<WorkspaceInfo | null> {
    const workspace = await db.workspace.findUnique({
      where: { externalId: externalId },
      include: {
        prebuildEvent: {
          include: { project: true, gitObject: true },
        },
        user: {
          include: { sshPublicKeys: true },
        },
        gitBranch: true,
        activeInstance: true,
      },
    });
    if (workspace == null) {
      return null;
    }
    if (workspace.userId !== requestingUserId) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Workspace does not belong to user");
    }
    return {
      externalId: workspace.externalId,
      status: workspace.status,
      name: workspace.name,
      branchName: formatBranchName(workspace.gitBranch.name),
      commitHash: workspace.prebuildEvent.gitObject.hash,
      project: {
        externalId: workspace.prebuildEvent.project.externalId,
        name: workspace.prebuildEvent.project.name,
        rootDirectoryPath: workspace.prebuildEvent.project.rootDirectoryPath,
      },
      agentHostname: this.agentHostname,
      workspaceHostname: workspace.activeInstance?.vmIp,
      lastOpenedAt: workspace.lastOpenedAt.getTime(),
      createdAt: workspace.createdAt.getTime(),
    };
  }
}
