/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `EnvironmentVariable` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "EnvironmentVariable" ADD COLUMN     "externalId" UUID NOT NULL DEFAULT uuid_generate_v4();

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentVariable_externalId_key" ON "EnvironmentVariable"("externalId");
