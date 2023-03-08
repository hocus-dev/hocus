/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `UserSSHPublicKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `UserSSHPublicKey` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserSSHPublicKey" ADD COLUMN     "externalId" UUID NOT NULL DEFAULT uuid_generate_v4(),
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserSSHPublicKey_externalId_key" ON "UserSSHPublicKey"("externalId");
