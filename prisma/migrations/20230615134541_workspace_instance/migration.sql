/*
  Warnings:

  - You are about to drop the column `firecrackerInstanceId` on the `WorkspaceInstance` table. All the data in the column will be lost.
  - Added the required column `runtimeInstanceId` to the `WorkspaceInstance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkspaceInstance" DROP COLUMN "firecrackerInstanceId",
ADD COLUMN     "runtimeInstanceId" TEXT NOT NULL;
