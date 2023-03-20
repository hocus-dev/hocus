/*
  Warnings:

  - A unique constraint covering the columns `[archivablePrebuildsMonitoringWorkflowId]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "archivablePrebuildsMonitoringWorkflowId" UUID NOT NULL DEFAULT uuid_generate_v4();

-- CreateIndex
CREATE UNIQUE INDEX "Project_archivablePrebuildsMonitoringWorkflowId_key" ON "Project"("archivablePrebuildsMonitoringWorkflowId");
