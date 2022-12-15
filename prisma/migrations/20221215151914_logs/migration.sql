-- CreateEnum
CREATE TYPE "LogGroupType" AS ENUM ('LOG_GROUP_TYPE_VM_TASK');

-- CreateEnum
CREATE TYPE "VmTaskStatus" AS ENUM ('VM_TASK_STATUS_PENDING', 'VM_TASK_STATUS_RUNNING', 'VM_TASK_STATUS_SUCCESS', 'VM_TASK_STATUS_ERROR', 'VM_TASK_STATUS_CANCELLED');

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
CREATE TABLE "PrebuildEvent" (
    "id" BIGSERIAL NOT NULL,

    CONSTRAINT "PrebuildEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrebuildEventTask" (
    "id" BIGSERIAL NOT NULL,
    "idx" INTEGER NOT NULL,
    "prebuildEventId" BIGINT NOT NULL,
    "vmTaskId" BIGINT NOT NULL,
    "originalCommand" TEXT NOT NULL,

    CONSTRAINT "PrebuildEventTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmTask" (
    "id" BIGSERIAL NOT NULL,
    "command" TEXT[],
    "cwd" TEXT,
    "status" "VmTaskStatus" NOT NULL,
    "logGroupId" BIGINT NOT NULL,

    CONSTRAINT "VmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildfsEvent" (
    "id" BIGSERIAL NOT NULL,
    "vmTaskId" BIGINT NOT NULL,
    "dockerfilePath" TEXT NOT NULL,
    "contextPath" TEXT NOT NULL,

    CONSTRAINT "BuildfsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Log_logGroupId_idx_key" ON "Log"("logGroupId", "idx");

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_logGroupId_fkey" FOREIGN KEY ("logGroupId") REFERENCES "LogGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventTask" ADD CONSTRAINT "PrebuildEventTask_prebuildEventId_fkey" FOREIGN KEY ("prebuildEventId") REFERENCES "PrebuildEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrebuildEventTask" ADD CONSTRAINT "PrebuildEventTask_vmTaskId_fkey" FOREIGN KEY ("vmTaskId") REFERENCES "VmTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmTask" ADD CONSTRAINT "VmTask_logGroupId_fkey" FOREIGN KEY ("logGroupId") REFERENCES "LogGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildfsEvent" ADD CONSTRAINT "BuildfsEvent_vmTaskId_fkey" FOREIGN KEY ("vmTaskId") REFERENCES "VmTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
