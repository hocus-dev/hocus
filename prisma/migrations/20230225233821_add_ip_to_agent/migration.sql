/*
  Warnings:

  - Added the required column `externalIp` to the `AgentInstance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AgentInstance" ADD COLUMN     "externalIp" TEXT NOT NULL;
