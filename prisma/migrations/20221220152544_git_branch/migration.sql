-- AlterTable
ALTER TABLE "GitRepository" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastBranchUpdateAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SshKeyPair" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "GitBranch" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "gitRepositoryId" BIGINT NOT NULL,
    "gitObjectId" BIGINT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitObject" (
    "id" BIGSERIAL NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitBranch_gitRepositoryId_name_key" ON "GitBranch"("gitRepositoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GitObject_hash_key" ON "GitObject"("hash");

-- AddForeignKey
ALTER TABLE "GitBranch" ADD CONSTRAINT "GitBranch_gitRepositoryId_fkey" FOREIGN KEY ("gitRepositoryId") REFERENCES "GitRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitBranch" ADD CONSTRAINT "GitBranch_gitObjectId_fkey" FOREIGN KEY ("gitObjectId") REFERENCES "GitObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
