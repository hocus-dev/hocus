/*
  Warnings:

  - You are about to drop the column `projectFileId` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `rootFsFileId` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the `BuildfsEventFiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `File` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PrebuildEventFiles` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `projectImageId` to the `Workspace` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rootFsImageId` to the `Workspace` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BuildfsEventFiles" DROP CONSTRAINT "BuildfsEventFiles_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "BuildfsEventFiles" DROP CONSTRAINT "BuildfsEventFiles_buildfsEventId_fkey";

-- DropForeignKey
ALTER TABLE "BuildfsEventFiles" DROP CONSTRAINT "BuildfsEventFiles_outputFileId_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "BuildfsEventFiles" DROP CONSTRAINT "BuildfsEventFiles_outputFileId_fkey";

-- DropForeignKey
ALTER TABLE "BuildfsEventFiles" DROP CONSTRAINT "BuildfsEventFiles_projectFileId_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "BuildfsEventFiles" DROP CONSTRAINT "BuildfsEventFiles_projectFileId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "PrebuildEventFiles" DROP CONSTRAINT "PrebuildEventFiles_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "PrebuildEventFiles" DROP CONSTRAINT "PrebuildEventFiles_fsFileId_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "PrebuildEventFiles" DROP CONSTRAINT "PrebuildEventFiles_fsFileId_fkey";

-- DropForeignKey
ALTER TABLE "PrebuildEventFiles" DROP CONSTRAINT "PrebuildEventFiles_prebuildEventId_fkey";

-- DropForeignKey
ALTER TABLE "PrebuildEventFiles" DROP CONSTRAINT "PrebuildEventFiles_projectFileId_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "PrebuildEventFiles" DROP CONSTRAINT "PrebuildEventFiles_projectFileId_fkey";

-- DropForeignKey
ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_projectFileId_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_projectFileId_fkey";

-- DropForeignKey
ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_rootFsFileId_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_rootFsFileId_fkey";

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "projectFileId",
DROP COLUMN "rootFsFileId",
ADD COLUMN     "projectImageId" BIGINT NOT NULL,
ADD COLUMN     "rootFsImageId" BIGINT NOT NULL;

-- DropTable
DROP TABLE "BuildfsEventFiles";

-- DropTable
DROP TABLE "File";

-- DropTable
DROP TABLE "PrebuildEventFiles";

-- CreateTable
CREATE TABLE "PrebuildEventImages" (
    "id" BIGSERIAL NOT NULL,
    "prebuildEventId" BIGINT NOT NULL,
    "fsImageId" BIGINT NOT NULL,
    "projectImageId" BIGINT NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,
    "localOciImageId" BIGINT,

    CONSTRAINT "PrebuildEventImages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildfsEventImages" (
    "id" BIGSERIAL NOT NULL,
    "buildfsEventId" BIGINT NOT NULL,
    "projectImageId" BIGINT NOT NULL,
    "outputImageId" BIGINT NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,

    CONSTRAINT "BuildfsEventImages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrebuildEventImages_prebuildEventId_agentInstanceId_key" ON "PrebuildEventImages"("prebuildEventId", "agentInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildfsEventImages_buildfsEventId_agentInstanceId_key" ON "BuildfsEventImages"("buildfsEventId", "agentInstanceId");

-- AddForeignKey
ALTER TABLE "PrebuildEventImages" ADD CONSTRAINT "PrebuildEventImages_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventImages" ADD CONSTRAINT "PrebuildEventImages_fsImageId_fkey" FOREIGN KEY ("fsImageId") REFERENCES "LocalOciImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventImages" ADD CONSTRAINT "PrebuildEventImages_projectImageId_fkey" FOREIGN KEY ("projectImageId") REFERENCES "LocalOciImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventImages" ADD CONSTRAINT "PrebuildEventImages_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventImages" ADD CONSTRAINT "PrebuildEventImages_fsImageId_agentInstanceId_fkey" FOREIGN KEY ("fsImageId", "agentInstanceId") REFERENCES "LocalOciImage"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventImages" ADD CONSTRAINT "PrebuildEventImages_projectImageId_agentInstanceId_fkey" FOREIGN KEY ("projectImageId", "agentInstanceId") REFERENCES "LocalOciImage"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventImages" ADD CONSTRAINT "PrebuildEventImages_localOciImageId_fkey" FOREIGN KEY ("localOciImageId") REFERENCES "LocalOciImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventImages" ADD CONSTRAINT "BuildfsEventImages_buildfsEventId_fkey" FOREIGN KEY ("buildfsEventId") REFERENCES "BuildfsEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventImages" ADD CONSTRAINT "BuildfsEventImages_projectImageId_fkey" FOREIGN KEY ("projectImageId") REFERENCES "LocalOciImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventImages" ADD CONSTRAINT "BuildfsEventImages_outputImageId_fkey" FOREIGN KEY ("outputImageId") REFERENCES "LocalOciImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventImages" ADD CONSTRAINT "BuildfsEventImages_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventImages" ADD CONSTRAINT "BuildfsEventImages_projectImageId_agentInstanceId_fkey" FOREIGN KEY ("projectImageId", "agentInstanceId") REFERENCES "LocalOciImage"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEventImages" ADD CONSTRAINT "BuildfsEventImages_outputImageId_agentInstanceId_fkey" FOREIGN KEY ("outputImageId", "agentInstanceId") REFERENCES "LocalOciImage"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_rootFsImageId_fkey" FOREIGN KEY ("rootFsImageId") REFERENCES "LocalOciImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_projectImageId_fkey" FOREIGN KEY ("projectImageId") REFERENCES "LocalOciImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_rootFsImageId_agentInstanceId_fkey" FOREIGN KEY ("rootFsImageId", "agentInstanceId") REFERENCES "LocalOciImage"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_projectImageId_agentInstanceId_fkey" FOREIGN KEY ("projectImageId", "agentInstanceId") REFERENCES "LocalOciImage"("id", "agentInstanceId") ON DELETE RESTRICT ON UPDATE CASCADE;
