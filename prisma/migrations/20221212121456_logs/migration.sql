-- CreateEnum
CREATE TYPE "LogGroupType" AS ENUM ('PrebuildTask');

-- CreateEnum
CREATE TYPE "PrebuildTaskStatus" AS ENUM ('PREBUILD_TASK_STATUS_PENDING', 'PREBUILD_TASK_STATUS_RUNNING', 'PREBUILD_TASK_STATUS_SUCCESS', 'PREBUILD_TASK_STATUS_ERROR', 'PREBUILD_TASK_STATUS_CANCELLED');

-- CreateTable
CREATE TABLE "LogGroup" (
    "id" BIGSERIAL NOT NULL,
    "type" "LogGroupType" NOT NULL,

    CONSTRAINT "LogGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" BIGSERIAL NOT NULL,
    "logGroupId" BIGINT NOT NULL,
    "idx" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInstance" (
    "id" BIGSERIAL NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "AgentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrebuildEvent" (
    "id" BIGSERIAL NOT NULL,
    "agentInstanceId" BIGINT NOT NULL,

    CONSTRAINT "PrebuildEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrebuildTask" (
    "id" BIGSERIAL NOT NULL,
    "command" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "status" "PrebuildTaskStatus" NOT NULL,
    "prebuildEventId" BIGINT NOT NULL,
    "logGroupId" BIGINT NOT NULL,

    CONSTRAINT "PrebuildTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Log_logGroupId_idx_key" ON "Log"("logGroupId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_externalId_key" ON "AgentInstance"("externalId");

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_logGroupId_fkey" FOREIGN KEY ("logGroupId") REFERENCES "LogGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEvent" ADD CONSTRAINT "PrebuildEvent_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildTask" ADD CONSTRAINT "PrebuildTask_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildTask" ADD CONSTRAINT "PrebuildTask_logGroupId_fkey" FOREIGN KEY ("logGroupId") REFERENCES "LogGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
