-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "gaUserId" UUID NOT NULL DEFAULT uuid_generate_v4(),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_gaUserId_key" ON "User"("gaUserId");
