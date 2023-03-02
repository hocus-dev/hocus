/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `VmTask` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "VmTask" ADD COLUMN     "externalId" UUID NOT NULL DEFAULT uuid_generate_v4();

-- CreateIndex
CREATE UNIQUE INDEX "VmTask_externalId_key" ON "VmTask"("externalId");
