/*
  Warnings:

  - The values [PREBUILD_EVENT_STATUS_PENDING] on the enum `PrebuildEventStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PrebuildEventStatus_new" AS ENUM ('PREBUILD_EVENT_STATUS_PENDING_INIT', 'PREBUILD_EVENT_STATUS_PENDING_READY', 'PREBUILD_EVENT_STATUS_RUNNING', 'PREBUILD_EVENT_STATUS_SUCCESS', 'PREBUILD_EVENT_STATUS_ERROR', 'PREBUILD_EVENT_STATUS_CANCELLED');
ALTER TABLE "PrebuildEvent" ALTER COLUMN "status" TYPE "PrebuildEventStatus_new" USING ("status"::text::"PrebuildEventStatus_new");
ALTER TYPE "PrebuildEventStatus" RENAME TO "PrebuildEventStatus_old";
ALTER TYPE "PrebuildEventStatus_new" RENAME TO "PrebuildEventStatus";
DROP TYPE "PrebuildEventStatus_old";
COMMIT;
