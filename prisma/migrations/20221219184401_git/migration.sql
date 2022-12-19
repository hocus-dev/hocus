-- CreateEnum
CREATE TYPE "SshKeyPairType" AS ENUM ('SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED', 'SSH_KEY_PAIR_TYPE_USER_SUPPLIED');

-- CreateTable
CREATE TABLE "SshKeyPair" (
    "id" BIGSERIAL NOT NULL,
    "type" "SshKeyPairType" NOT NULL,
    "privateKey" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,

    CONSTRAINT "SshKeyPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitRepository" (
    "id" BIGSERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "sshKeyPairId" BIGINT NOT NULL,

    CONSTRAINT "GitRepository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitRepository_url_key" ON "GitRepository"("url");

-- AddForeignKey
ALTER TABLE "GitRepository" ADD CONSTRAINT "GitRepository_sshKeyPairId_fkey" FOREIGN KEY ("sshKeyPairId") REFERENCES "SshKeyPair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
