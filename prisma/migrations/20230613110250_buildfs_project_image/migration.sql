/*
  Warnings:

  - You are about to drop the column `projectImageId` on the `BuildfsEventImages` table. All the data in the column will be lost.
  - You are about to drop the column `localOciImageId` on the `PrebuildEventImages` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "BuildfsEventImages" DROP CONSTRAINT "BuildfsEventImages_projectImageId_agentInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "BuildfsEventImages" DROP CONSTRAINT "BuildfsEventImages_projectImageId_fkey";

-- DropForeignKey
ALTER TABLE "PrebuildEventImages" DROP CONSTRAINT "PrebuildEventImages_localOciImageId_fkey";

-- AlterTable
ALTER TABLE "BuildfsEventImages" DROP COLUMN "projectImageId";

-- AlterTable
ALTER TABLE "PrebuildEventImages" DROP COLUMN "localOciImageId";
