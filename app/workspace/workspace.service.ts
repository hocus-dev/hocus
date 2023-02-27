import type { Prisma, WorkspaceStatus } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import type { Config } from "unique-names-generator";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";
import { HttpError } from "~/http-error.server";

export interface WorkspaceInfo {
  status: WorkspaceStatus;
  name: string;
  branchName: string;
  commitHash: string;
  project: {
    externalId: string;
    name: string;
  };
}
export class WorkspaceService {
  private nameGeneratorConfig: Config = {
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
        gitBranch: true,
      },
    });
    if (workspace == null) {
      return null;
    }
    if (workspace.userId !== requestingUserId) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Workspace does not belong to user");
    }
    return {
      status: workspace.status,
      name: workspace.name,
      branchName: workspace.gitBranch.name,
      commitHash: workspace.prebuildEvent.gitObject.hash,
      project: {
        externalId: workspace.prebuildEvent.project.externalId,
        name: workspace.prebuildEvent.project.name,
      },
    };
  }
}
