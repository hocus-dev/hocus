/*
  Warnings:

  - You are about to drop the `PrebuildEventToGitBranch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PrebuildEventToGitBranch" DROP CONSTRAINT "PrebuildEventToGitBranch_gitBranchId_fkey";

-- DropForeignKey
ALTER TABLE "PrebuildEventToGitBranch" DROP CONSTRAINT "PrebuildEventToGitBranch_prebuildEventId_fkey";

-- DropTable
DROP TABLE "PrebuildEventToGitBranch";

-- CreateTable
CREATE TABLE "GitObjectToBranch" (
    "id" BIGSERIAL NOT NULL,
    "gitObjectId" BIGINT NOT NULL,
    "gitBranchId" BIGINT NOT NULL,

    CONSTRAINT "GitObjectToBranch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitObjectToBranch_gitObjectId_gitBranchId_key" ON "GitObjectToBranch"("gitObjectId", "gitBranchId");

-- AddForeignKey
ALTER TABLE "GitObjectToBranch" ADD CONSTRAINT "GitObjectToBranch_gitObjectId_fkey" FOREIGN KEY ("gitObjectId") REFERENCES "GitObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitObjectToBranch" ADD CONSTRAINT "GitObjectToBranch_gitBranchId_fkey" FOREIGN KEY ("gitBranchId") REFERENCES "GitBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
