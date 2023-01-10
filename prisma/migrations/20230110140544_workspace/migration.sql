-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('WORKSPACE_STATUS_PENDING_CREATE', 'WORKSPACE_STATUS_STOPPED', 'WORKSPACE_STATUS_PENDING_START', 'WORKSPACE_STATUS_STARTED', 'WORKSPACE_STATUS_PENDING_STOP');

-- AlterTable
ALTER TABLE "PrebuildEvent" ADD COLUMN     "workspaceTasks" TEXT[];

-- CreateTable
CREATE TABLE "Workspace" (
    "id" BIGSERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "prebuildEventId" BIGINT NOT NULL,
    "gitBranchId" BIGINT NOT NULL,
    "rootFsFileId" BIGINT NOT NULL,
    "projectFileId" BIGINT NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,
    "status" "WorkspaceStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_gitBranchId_fkey" FOREIGN KEY ("gitBranchId") REFERENCES "GitBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_rootFsFileId_fkey" FOREIGN KEY ("rootFsFileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_rootFsFileId_agentInstanceId_fkey" FOREIGN KEY ("rootFsFileId", "agentInstanceId") REFERENCES "File"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_projectFileId_agentInstanceId_fkey" FOREIGN KEY ("projectFileId", "agentInstanceId") REFERENCES "File"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;
