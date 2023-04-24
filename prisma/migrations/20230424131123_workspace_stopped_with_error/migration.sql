-- AlterEnum
ALTER TYPE "WorkspaceStatus" ADD VALUE 'WORKSPACE_STATUS_STOPPED_WITH_ERROR';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "latestError" TEXT;
