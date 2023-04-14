-- CreateTable
CREATE TABLE "PrebuildEventSystemError" (
    "id" BIGSERIAL NOT NULL,
    "prebuildEventId" BIGINT NOT NULL,
    "message" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrebuildEventSystemError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrebuildEventSystemError_prebuildEventId_key" ON "PrebuildEventSystemError"("prebuildEventId");

-- AddForeignKey
ALTER TABLE "PrebuildEventSystemError" ADD CONSTRAINT "PrebuildEventSystemError_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
