/*
  Warnings:

  - You are about to drop the column `maxPrebuildRootDriveSizeMib` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `maxWorkspaceProjectDriveSizeMib` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `maxWorkspaceRootDriveSizeMib` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "maxPrebuildRootDriveSizeMib",
DROP COLUMN "maxWorkspaceProjectDriveSizeMib",
DROP COLUMN "maxWorkspaceRootDriveSizeMib";
