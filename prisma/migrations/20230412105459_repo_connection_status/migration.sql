-- CreateTable
CREATE TABLE "GitRepositoryConnectionStatus" (
    "id" BIGSERIAL NOT NULL,
    "gitRepositoryId" BIGINT NOT NULL,
    "lastSuccessfulConnectionAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitRepositoryConnectionStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitRepositoryConnectionError" (
    "id" BIGSERIAL NOT NULL,
    "connectionStatusId" BIGINT NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitRepositoryConnectionError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitRepositoryConnectionStatus_gitRepositoryId_key" ON "GitRepositoryConnectionStatus"("gitRepositoryId");

-- CreateIndex
CREATE INDEX "GitRepositoryConnectionError_connectionStatusId_createdAt_idx" ON "GitRepositoryConnectionError"("connectionStatusId", "createdAt");

-- AddForeignKey
ALTER TABLE "GitRepositoryConnectionStatus" ADD CONSTRAINT "GitRepositoryConnectionStatus_gitRepositoryId_fkey" FOREIGN KEY ("gitRepositoryId") REFERENCES "GitRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitRepositoryConnectionError" ADD CONSTRAINT "GitRepositoryConnectionError_connectionStatusId_fkey" FOREIGN KEY ("connectionStatusId") REFERENCES "GitRepositoryConnectionStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
