-- CreateTable
CREATE TABLE "Room" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "playerId" BIGINT NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
