/*
  Warnings:

  - Added the required column `cacheHash` to the `BuildfsEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gitObjectId` to the `PrebuildEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `PrebuildEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `PrebuildEvent` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PrebuildEventStatus" AS ENUM ('PREBUILD_EVENT_STATUS_PENDING', 'PREBUILD_EVENT_STATUS_RUNNING', 'PREBUILD_EVENT_STATUS_SUCCESS', 'PREBUILD_EVENT_STATUS_ERROR', 'PREBUILD_EVENT_STATUS_CANCELLED', 'PREBUILD_EVENT_STATUS_SKIPPED');

-- AlterTable
ALTER TABLE "BuildfsEvent" ADD COLUMN     "cacheHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PrebuildEvent" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gitObjectId" BIGINT NOT NULL,
ADD COLUMN     "projectId" BIGINT NOT NULL,
ADD COLUMN     "status" "PrebuildEventStatus" NOT NULL;

-- CreateTable
CREATE TABLE "PrebuildEventFile" (
    "id" BIGSERIAL NOT NULL,
    "prebuildEventId" BIGINT NOT NULL,
    "fileId" BIGINT NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,

    CONSTRAINT "PrebuildEventFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrebuildEventToGitBranch" (
    "id" BIGSERIAL NOT NULL,
    "prebuildEventId" BIGINT NOT NULL,
    "gitBranchId" BIGINT NOT NULL,

    CONSTRAINT "PrebuildEventToGitBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildfsEventFile" (
    "id" BIGSERIAL NOT NULL,
    "buildfsEventId" BIGINT NOT NULL,
    "fileId" BIGINT NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,

    CONSTRAINT "BuildfsEventFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitRepositoryFile" (
    "id" BIGSERIAL NOT NULL,
    "gitRepositoryId" BIGINT NOT NULL,
    "fileId" BIGINT NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitRepositoryFile_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "PrebuildEventFile_prebuildEventId_agentInstanceId_key" ON "PrebuildEventFile"("prebuildEventId", "agentInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "PrebuildEventToGitBranch_prebuildEventId_gitBranchId_key" ON "PrebuildEventToGitBranch"("prebuildEventId", "gitBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildfsEventFile_buildfsEventId_agentInstanceId_key" ON "BuildfsEventFile"("buildfsEventId", "agentInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "GitRepositoryFile_gitRepositoryId_fileId_key" ON "GitRepositoryFile"("gitRepositoryId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "GitRepositoryFile_gitRepositoryId_agentInstanceId_key" ON "GitRepositoryFile"("gitRepositoryId", "agentInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_externalId_key" ON "AgentInstance"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "File_id_agentInstanceId_key" ON "File"("id", "agentInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "File_agentInstanceId_path_key" ON "File"("agentInstanceId", "path");

-- CreateIndex
CREATE INDEX "BuildfsEvent_cacheHash_idx" ON "BuildfsEvent"("cacheHash");

-- AddForeignKey
ALTER TABLE "PrebuildEvent" ADD CONSTRAINT "PrebuildEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEvent" ADD CONSTRAINT "PrebuildEvent_gitObjectId_fkey" FOREIGN KEY ("gitObjectId") REFERENCES "GitObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventFile" ADD CONSTRAINT "PrebuildEventFile_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventFile" ADD CONSTRAINT "PrebuildEventFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventFile" ADD CONSTRAINT "PrebuildEventFile_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventFile" ADD CONSTRAINT "PrebuildEventFile_fileId_agentInstanceId_fkey" FOREIGN KEY ("fileId", "agentInstanceId") REFERENCES "File"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventToGitBranch" ADD CONSTRAINT "PrebuildEventToGitBranch_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventToGitBranch" ADD CONSTRAINT "PrebuildEventToGitBranch_gitBranchId_fkey" FOREIGN KEY ("gitBranchId") REFERENCES "GitBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventFile" ADD CONSTRAINT "BuildfsEventFile_buildfsEventId_fkey" FOREIGN KEY ("buildfsEventId") REFERENCES "BuildfsEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventFile" ADD CONSTRAINT "BuildfsEventFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventFile" ADD CONSTRAINT "BuildfsEventFile_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventFile" ADD CONSTRAINT "BuildfsEventFile_fileId_agentInstanceId_fkey" FOREIGN KEY ("fileId", "agentInstanceId") REFERENCES "File"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitRepositoryFile" ADD CONSTRAINT "GitRepositoryFile_gitRepositoryId_fkey" FOREIGN KEY ("gitRepositoryId") REFERENCES "GitRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitRepositoryFile" ADD CONSTRAINT "GitRepositoryFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitRepositoryFile" ADD CONSTRAINT "GitRepositoryFile_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitRepositoryFile" ADD CONSTRAINT "GitRepositoryFile_fileId_agentInstanceId_fkey" FOREIGN KEY ("fileId", "agentInstanceId") REFERENCES "File"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_gitRepositoryId_fkey" FOREIGN KEY ("gitRepositoryId") REFERENCES "GitRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
