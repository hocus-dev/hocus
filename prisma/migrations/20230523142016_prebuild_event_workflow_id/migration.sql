/*
  Warnings:

  - A unique constraint covering the columns `[workflowId]` on the table `PrebuildEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PrebuildEvent" ADD COLUMN     "workflowId" UUID NOT NULL DEFAULT uuid_generate_v4();

-- CreateIndex
CREATE UNIQUE INDEX "PrebuildEvent_workflowId_key" ON "PrebuildEvent"("workflowId");
