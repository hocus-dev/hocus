/*
  Warnings:

  - Added the required column `maxPrebuildProjectDriveSizeMib` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxPrebuildRamMib` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxPrebuildRootDriveSizeMib` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxPrebuildVCPUCount` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxWorkspaceProjectDriveSizeMib` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxWorkspaceRamMib` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxWorkspaceRootDriveSizeMib` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxWorkspaceVCPUCount` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "maxPrebuildProjectDriveSizeMib" INTEGER NOT NULL,
ADD COLUMN     "maxPrebuildRamMib" INTEGER NOT NULL,
ADD COLUMN     "maxPrebuildRootDriveSizeMib" INTEGER NOT NULL,
ADD COLUMN     "maxPrebuildVCPUCount" INTEGER NOT NULL,
ADD COLUMN     "maxWorkspaceProjectDriveSizeMib" INTEGER NOT NULL,
ADD COLUMN     "maxWorkspaceRamMib" INTEGER NOT NULL,
ADD COLUMN     "maxWorkspaceRootDriveSizeMib" INTEGER NOT NULL,
ADD COLUMN     "maxWorkspaceVCPUCount" INTEGER NOT NULL;
