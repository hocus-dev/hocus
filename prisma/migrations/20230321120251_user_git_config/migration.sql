/*
  Warnings:

  - Added the required column `gitConfigId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gitConfigId" BIGINT NOT NULL;

-- CreateTable
CREATE TABLE "UserGitConfig" (
    "id" BIGSERIAL NOT NULL,
    "gitUsername" TEXT NOT NULL,
    "gitEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGitConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gitConfigId_fkey" FOREIGN KEY ("gitConfigId") REFERENCES "UserGitConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
