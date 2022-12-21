/*
  Warnings:

  - Added the required column `gitObjectId` to the `PrebuildEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `PrebuildEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PrebuildEvent" ADD COLUMN     "gitObjectId" BIGINT NOT NULL,
ADD COLUMN     "projectId" BIGINT NOT NULL;

-- CreateTable
CREATE TABLE "PrebuildEventToGitBranch" (
    "id" BIGSERIAL NOT NULL,
    "prebuildEventId" BIGINT NOT NULL,
    "gitBranchId" BIGINT NOT NULL,

    CONSTRAINT "PrebuildEventToGitBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" BIGSERIAL NOT NULL,
    "gitRepositoryId" BIGINT NOT NULL,
    "rootDirectoryPath" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInstance" (
    "id" BIGSERIAL NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "AgentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" BIGSERIAL NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrebuildEventToGitBranch_prebuildEventId_gitBranchId_key" ON "PrebuildEventToGitBranch"("prebuildEventId", "gitBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_externalId_key" ON "AgentInstance"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "File_agentInstanceId_path_key" ON "File"("agentInstanceId", "path");

-- AddForeignKey
ALTER TABLE "PrebuildEvent" ADD CONSTRAINT "PrebuildEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEvent" ADD CONSTRAINT "PrebuildEvent_gitObjectId_fkey" FOREIGN KEY ("gitObjectId") REFERENCES "GitObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventToGitBranch" ADD CONSTRAINT "PrebuildEventToGitBranch_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventToGitBranch" ADD CONSTRAINT "PrebuildEventToGitBranch_gitBranchId_fkey" FOREIGN KEY ("gitBranchId") REFERENCES "GitBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_gitRepositoryId_fkey" FOREIGN KEY ("gitRepositoryId") REFERENCES "GitRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
