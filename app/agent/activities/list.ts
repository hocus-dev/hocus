import type { Prisma } from "@prisma/client";

import type { AgentInjector } from "../agent-injector";

import { addProjectAndRepository } from "./add-project-and-repository";
import { deleteLocalPrebuildEventFiles } from "./archive-prebuild-event/delete-local-prebuild-event-files";
import { deleteRemovablePrebuildEvents } from "./archive-prebuild-event/delete-removable-prebuild-events";
import { getArchivablePrebuildEvents } from "./archive-prebuild-event/get-archivable-prebuild-events";
import { markPrebuildEventAsArchived } from "./archive-prebuild-event/mark-prebuild-event-as-archived";
import { removePrebuildEventReservation } from "./archive-prebuild-event/remove-prebuild-event-reservation";
import { reservePrebuildEvent } from "./archive-prebuild-event/reserve-prebuild-event";
import { waitForPrebuildEventReservations } from "./archive-prebuild-event/wait-for-prebuild-event-reservations";
import { buildfs } from "./buildfs";
import { cancelPrebuilds } from "./cancel-prebuilds";
import { changePrebuildEventStatus } from "./change-prebuild-event-status";
import { checkoutAndInspect } from "./checkout-and-inspect";
import { cleanUpAfterPrebuildError } from "./clean-up-after-prebuild-error";
import { createPrebuildEvent } from "./create-prebuild-event";
import { createPrebuildFiles } from "./create-prebuild-files";
import { createWorkspace } from "./create-workspace";
import { deleteWorkspace } from "./delete-workspace";
import { fetchRepository } from "./fetch-repository";
import { getDefaultBranch } from "./get-default-branch";
import { getOrCreateBuildfsEvents } from "./get-or-create-buildfs-events";
import { getOrCreatePrebuildEvents } from "./get-or-create-prebuild-events";
import { getPrebuildEvents } from "./get-prebuild-events";
import { getRepositoryProjects } from "./get-repository-projects";
import { getWorkspaceInstanceStatus } from "./get-workspace-instance-status";
import { initPrebuildEvents } from "./init-prebuild-events";
import { getWorkflowStatus } from "./mutex/get-workflow-status";
import { signalWithStartLockWorkflow } from "./mutex/signal-with-start-lock-workflow";
import { mutexTest } from "./mutex/test-activity";
import { prebuild } from "./prebuild";
import { saveGitRepoConnectionStatus } from "./save-git-repo-connection-status";
import { startWorkspace } from "./start-workspace";
import { stopWorkspace } from "./stop-workspace";
import type { CreateActivity } from "./types";
import { updateGitBranchesAndObjects } from "./update-git-branches-and-objects";
import { waitForBuildfs } from "./wait-for-buildfs";
import { cleanUpWorkspaceInstanceDb } from "./workspace/clean-up-workspace-instance";
import { cleanUpWorkspaceInstanceLocal } from "./workspace/clean-up-workspace-instance";

const activities = {
  fetchRepository,
  buildfs,
  checkoutAndInspect,
  prebuild,
  cancelPrebuilds,
  changePrebuildEventStatus,
  createWorkspace,
  startWorkspace,
  stopWorkspace,
  getOrCreateBuildfsEvents,
  createPrebuildFiles,
  getWorkspaceInstanceStatus,
  addProjectAndRepository,
  getRepositoryProjects,
  updateGitBranchesAndObjects,
  getDefaultBranch,
  deleteWorkspace,
  getOrCreatePrebuildEvents,
  initPrebuildEvents,
  getPrebuildEvents,
  waitForBuildfs,
  reservePrebuildEvent,
  removePrebuildEventReservation,
  waitForPrebuildEventReservations,
  markPrebuildEventAsArchived,
  deleteLocalPrebuildEventFiles,
  deleteRemovablePrebuildEvents,
  getArchivablePrebuildEvents,
  saveGitRepoConnectionStatus,
  cleanUpAfterPrebuildError,
  cleanUpWorkspaceInstanceLocal,
  signalWithStartLockWorkflow,
  mutexTest,
  getWorkflowStatus,
  cleanUpWorkspaceInstanceDb,
  createPrebuildEvent,
} as const;

const _typecheck: typeof activities extends Record<string, CreateActivity<any>> ? 1 : 0 = 1;

type ExtractActivityType<T> = T extends CreateActivity<infer A> ? A : never;

export type ActivitiesCreateFns = typeof activities;
export type Activities = {
  [K in keyof ActivitiesCreateFns]: ExtractActivityType<ActivitiesCreateFns[K]>;
};
export interface ActivityArgs {
  injector: AgentInjector;
  db: Prisma.NonTransactionClient;
}

export const createActivities = async (
  injector: AgentInjector,
  db: Prisma.NonTransactionClient,
): Promise<Activities> => {
  return Object.fromEntries(
    Object.entries(activities).map(([name, fn]) => {
      return [name, fn({ injector, db })] as const;
    }),
  ) as any;
};
