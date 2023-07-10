/*
  Warnings:

  - You are about to drop the `GitRepositoryFile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GitRepositoryFile" DROP CONSTRAINT "GitRepositoryFile_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "GitRepositoryFile" DROP CONSTRAINT "GitRepositoryFile_fileId_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "GitRepositoryFile" DROP CONSTRAINT "GitRepositoryFile_fileId_fkey";

-- DropForeignKey
ALTER TABLE "GitRepositoryFile" DROP CONSTRAINT "GitRepositoryFile_gitRepositoryId_fkey";

-- DropTable
DROP TABLE "GitRepositoryFile";

-- CreateTable
CREATE TABLE "GitRepositoryImage" (
    "id" BIGSERIAL NOT NULL,
    "gitRepositoryId" BIGINT NOT NULL,
    "localOciImageId" BIGINT NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitRepositoryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalOciImage" (
    "id" BIGSERIAL NOT NULL,
    "externalId" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tag" TEXT NOT NULL,
    "readonly" BOOLEAN NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,

    CONSTRAINT "LocalOciImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitRepositoryImage_gitRepositoryId_localOciImageId_key" ON "GitRepositoryImage"("gitRepositoryId", "localOciImageId");

-- CreateIndex
CREATE UNIQUE INDEX "GitRepositoryImage_gitRepositoryId_agentInstanceId_key" ON "GitRepositoryImage"("gitRepositoryId", "agentInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalOciImage_externalId_key" ON "LocalOciImage"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalOciImage_agentInstanceId_id_key" ON "LocalOciImage"("agentInstanceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LocalOciImage_agentInstanceId_tag_key" ON "LocalOciImage"("agentInstanceId", "tag");

-- AddForeignKey
ALTER TABLE "GitRepositoryImage" ADD CONSTRAINT "GitRepositoryImage_gitRepositoryId_fkey" FOREIGN KEY ("gitRepositoryId") REFERENCES "GitRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitRepositoryImage" ADD CONSTRAINT "GitRepositoryImage_localOciImageId_fkey" FOREIGN KEY ("localOciImageId") REFERENCES "LocalOciImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitRepositoryImage" ADD CONSTRAINT "GitRepositoryImage_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitRepositoryImage" ADD CONSTRAINT "GitRepositoryImage_localOciImageId_agentInstanceId_fkey" FOREIGN KEY ("localOciImageId", "agentInstanceId") REFERENCES "LocalOciImage"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalOciImage" ADD CONSTRAINT "LocalOciImage_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
