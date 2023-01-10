import type { Prisma, Workspace } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import type { Config } from "unique-names-generator";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import { HOST_PERSISTENT_DIR } from "~/agent/constants";
import { waitForPromises } from "~/utils.shared";

export class WorkspaceService {
  private nameGeneratorConfig: Config = {
    dictionaries: [adjectives, animals],
    length: 2,
    separator: " ",
    style: "capital",
  };

  async createWorkspaceInDb(
    db: Prisma.TransactionClient,
    args: {
      name: string;
      externalId: string;
      prebuildEventId: bigint;
      agentInstanceId: bigint;
      gitBranchId: bigint;
      userId: bigint;
    },
  ): Promise<Workspace> {
    const externalId = uuidv4();
    const dirPath = `${HOST_PERSISTENT_DIR}/workspace/${externalId}` as const;
    const projectFilePath = `${dirPath}/project.ext4` as const;
    const rootFsFilePath = `${dirPath}/rootfs.ext4` as const;

    const [rootFsFile, projectFile] = await waitForPromises(
      [rootFsFilePath, projectFilePath].map((filePath) =>
        db.file.create({
          data: {
            path: filePath,
            agentInstanceId: args.agentInstanceId,
          },
        }),
      ),
    );
    return await db.workspace.create({
      data: {
        name: args.name,
        externalId: args.externalId,
        gitBranchId: args.gitBranchId,
        status: WorkspaceStatus.WORKSPACE_STATUS_PENDING_CREATE,
        prebuildEventId: args.prebuildEventId,
        agentInstanceId: args.agentInstanceId,
        userId: args.userId,
        rootFsFileId: rootFsFile.id,
        projectFileId: projectFile.id,
      },
    });
  }

  async changeWorkspaceStatus(
    db: Prisma.Client,
    workspaceId: bigint,
    status: WorkspaceStatus,
  ): Promise<void> {
    await db.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        status,
      },
    });
  }

  generateWorkspaceName(): string {
    return uniqueNamesGenerator(this.nameGeneratorConfig);
  }
}
