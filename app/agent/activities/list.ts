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
import { changePrebuildEventStatus } from "./change-prebuild-event-status";
import { checkoutAndInspect } from "./checkout-and-inspect";
import { cleanUpAfterPrebuildError } from "./clean-up-after-prebuild-error";
import { createPrebuildEvent } from "./create-prebuild-event";
import { createPrebuildImages } from "./create-prebuild-images";
import { fetchRepository } from "./fetch-repository";
import { getDefaultBranch } from "./get-default-branch";
import { getOrCreateBuildfsEvents } from "./get-or-create-buildfs-events";
import { getOrCreatePrebuildEvents } from "./get-or-create-prebuild-events";
import { getPrebuildEvents } from "./get-prebuild-events";
import { getProjectsRepository } from "./get-projects-repository";
import { getRepositoryProjects } from "./get-repository-projects";
import { initPrebuildEvents } from "./init-prebuild-events";
import { getWorkflowStatus } from "./mutex/get-workflow-status";
import { signalWithStartLockWorkflow } from "./mutex/signal-with-start-lock-workflow";
import { prebuild } from "./prebuild";
import { removeContentWithPrefix } from "./registry/remove-content-with-prefix";
import { saveGitRepoConnectionStatus } from "./save-git-repo-connection-status";
import { signalWithStartWaitWorkflow } from "./shared-workflow/signal-with-start-wait-workflow";
import type { CreateActivity } from "./types";
import { updateGitBranchesAndObjects } from "./update-git-branches-and-objects";
import { cleanUpWorkspaceInstanceDb } from "./workspace/clean-up-workspace-instance";
import { cleanUpWorkspaceInstanceLocal } from "./workspace/clean-up-workspace-instance";
import { createWorkspace } from "./workspace/create-workspace";
import { deleteWorkspace } from "./workspace/delete-workspace";
import { getWorkspaceInstanceStatus } from "./workspace/get-workspace-instance-status";
import { startWorkspace } from "./workspace/start-workspace";
import { stopWorkspace } from "./workspace/stop-workspace";

const activities = {
  fetchRepository,
  buildfs,
  checkoutAndInspect,
  prebuild,
  changePrebuildEventStatus,
  createWorkspace,
  startWorkspace,
  stopWorkspace,
  getOrCreateBuildfsEvents,
  createPrebuildImages,
  getWorkspaceInstanceStatus,
  addProjectAndRepository,
  getRepositoryProjects,
  updateGitBranchesAndObjects,
  getDefaultBranch,
  deleteWorkspace,
  getOrCreatePrebuildEvents,
  initPrebuildEvents,
  getPrebuildEvents,
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
  getWorkflowStatus,
  cleanUpWorkspaceInstanceDb,
  createPrebuildEvent,
  signalWithStartWaitWorkflow,
  getProjectsRepository,
  removeContentWithPrefix,
} as const;

const _typeCheck: typeof activities extends Record<string, CreateActivity<any>> ? 1 : 0 = 1;

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
