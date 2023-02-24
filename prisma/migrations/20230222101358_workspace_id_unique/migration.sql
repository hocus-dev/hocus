/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Workspace_externalId_key" ON "Workspace"("externalId");
