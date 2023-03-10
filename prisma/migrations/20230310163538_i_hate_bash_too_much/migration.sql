/*
  Warnings:

  - You are about to drop the column `workspaceTasks` on the `PrebuildEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PrebuildEvent" DROP COLUMN "workspaceTasks",
ADD COLUMN     "workspaceTasksCommand" TEXT[],
ADD COLUMN     "workspaceTasksShell" TEXT[];
