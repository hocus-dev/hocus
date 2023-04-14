import { PrebuildEventStatus } from "@prisma/client";

export const PREBUILD_DEV_DIR = "/home/hocus/dev" as const;
export const PREBUILD_REPOSITORY_DIR = `${PREBUILD_DEV_DIR}/project` as const;
export const PREBUILD_SCRIPTS_DIR = `${PREBUILD_DEV_DIR}/.hocus/init` as const;
export const SUCCESSFUL_PREBUILD_STATES = [
  PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS,
  PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_ARCHIVE,
  PrebuildEventStatus.PREBUILD_EVENT_STATUS_ARCHIVED,
] as const;
export const UNSUCCESSFUL_PREBUILD_STATES = [
  PrebuildEventStatus.PREBUILD_EVENT_STATUS_ERROR,
  PrebuildEventStatus.PREBUILD_EVENT_STATUS_CANCELLED,
  PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_INIT,
  PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_READY,
  PrebuildEventStatus.PREBUILD_EVENT_STATUS_RUNNING,
] as const;
