/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `BuildfsEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BuildfsEvent" ADD COLUMN     "externalId" UUID NOT NULL DEFAULT uuid_generate_v4();

-- CreateIndex
CREATE UNIQUE INDEX "BuildfsEvent_externalId_key" ON "BuildfsEvent"("externalId");
