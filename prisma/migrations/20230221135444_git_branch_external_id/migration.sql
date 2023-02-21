/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `GitBranch` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GitBranch" ADD COLUMN     "externalId" UUID NOT NULL DEFAULT uuid_generate_v4();

-- CreateIndex
CREATE UNIQUE INDEX "GitBranch_externalId_key" ON "GitBranch"("externalId");
