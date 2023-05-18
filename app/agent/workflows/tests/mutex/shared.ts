import { defineSignal, defineQuery } from "@temporalio/workflow";

export const releaseLockSignal = defineSignal<[]>("release-lock");
export const cancelLockSignal = defineSignal<[]>("cancel-lock");
export const isLockAcquiredQuery = defineQuery<boolean>("is-lock-acquired");
