-- CreateTable
CREATE TABLE "UserProjectEnvironmentVariableSet" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "environmentSetId" BIGINT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProjectEnvironmentVariableSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProjectEnvironmentVariableSet_userId_projectId_key" ON "UserProjectEnvironmentVariableSet"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "UserProjectEnvironmentVariableSet" ADD CONSTRAINT "UserProjectEnvironmentVariableSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectEnvironmentVariableSet" ADD CONSTRAINT "UserProjectEnvironmentVariableSet_environmentSetId_fkey" FOREIGN KEY ("environmentSetId") REFERENCES "EnvironmentVariableSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectEnvironmentVariableSet" ADD CONSTRAINT "UserProjectEnvironmentVariableSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
