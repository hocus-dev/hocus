-- CreateEnum
CREATE TYPE "PrebuildEventReservationType" AS ENUM ('PREBUILD_EVENT_RESERVATION_TYPE_CREATE_WORKSPACE', 'PREBUILD_EVENT_RESERVATION_TYPE_ARCHIVE_PREBUILD');

-- AlterEnum
ALTER TYPE "PrebuildEventStatus" ADD VALUE 'PREBUILD_EVENT_STATUS_ARCHIVED';

-- CreateTable
CREATE TABLE "PrebuildEventReservation" (
    "id" BIGSERIAL NOT NULL,
    "externalId" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "prebuildEventId" BIGINT NOT NULL,
    "validUntil" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "PrebuildEventReservationType" NOT NULL,

    CONSTRAINT "PrebuildEventReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrebuildEventReservation_externalId_key" ON "PrebuildEventReservation"("externalId");

-- AddForeignKey
ALTER TABLE "PrebuildEventReservation" ADD CONSTRAINT "PrebuildEventReservation_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
