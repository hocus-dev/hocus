import type { Prisma } from "@prisma/client";

import type { AgentInjector } from "../agent-injector";

import type { AddProjectAndRepositoryActivity } from "./add-project-and-repository";
import { addProjectAndRepository } from "./add-project-and-repository";
import { deleteLocalPrebuildEventFiles } from "./archive-prebuild-event/delete-local-prebuild-event-files";
import type { DeleteLocalPrebuildEventFilesActivity } from "./archive-prebuild-event/delete-local-prebuild-event-files";
import type { DeleteRemovablePrebuildEventsActivity } from "./archive-prebuild-event/delete-removable-prebuild-events";
import { deleteRemovablePrebuildEvents } from "./archive-prebuild-event/delete-removable-prebuild-events";
import type { GetArchivablePrebuildEventsActivity } from "./archive-prebuild-event/get-archivable-prebuild-events";
import { getArchivablePrebuildEvents } from "./archive-prebuild-event/get-archivable-prebuild-events";
import type { MarkPrebuildEventAsArchivedActivity } from "./archive-prebuild-event/mark-prebuild-event-as-archived";
import { markPrebuildEventAsArchived } from "./archive-prebuild-event/mark-prebuild-event-as-archived";
import type { RemovePrebuildEventReservationActivity } from "./archive-prebuild-event/remove-prebuild-event-reservation";
import { removePrebuildEventReservation } from "./archive-prebuild-event/remove-prebuild-event-reservation";
import type { ReservePrebuildEventActivity } from "./archive-prebuild-event/reserve-prebuild-event";
import { reservePrebuildEvent } from "./archive-prebuild-event/reserve-prebuild-event";
import type { WaitForPrebuildEventReservationsActivity } from "./archive-prebuild-event/wait-for-prebuild-event-reservations";
import { waitForPrebuildEventReservations } from "./archive-prebuild-event/wait-for-prebuild-event-reservations";
import type { BuildfsActivity } from "./buildfs";
import { buildfs } from "./buildfs";
import type { CancelPrebuildsActivity } from "./cancel-prebuilds";
import { cancelPrebuilds } from "./cancel-prebuilds";
import type { ChangePrebuildEventStatusActivity } from "./change-prebuild-event-status";
import { changePrebuildEventStatus } from "./change-prebuild-event-status";
import type { CheckoutAndInspectActivity } from "./checkout-and-inspect";
import { checkoutAndInspect } from "./checkout-and-inspect";
import type { CleanUpAfterPrebuildErrorActivity } from "./clean-up-after-prebuild-error";
import { cleanUpAfterPrebuildError } from "./clean-up-after-prebuild-error";
import type { CreatePrebuildFilesActivity } from "./create-prebuild-files";
import { createPrebuildFiles } from "./create-prebuild-files";
import type { CreateWorkspaceActivity } from "./create-workspace";
import { createWorkspace } from "./create-workspace";
import type { DeleteWorkspaceActivity } from "./delete-workspace";
import { deleteWorkspace } from "./delete-workspace";
import type { FetchRepositoryActivity } from "./fetch-repository";
import { fetchRepository } from "./fetch-repository";
import type { GetDefaultBranchActivity } from "./get-default-branch";
import { getDefaultBranch } from "./get-default-branch";
import type { GetOrCreateBuildfsEventsActivity } from "./get-or-create-buildfs-events";
import { getOrCreateBuildfsEvents } from "./get-or-create-buildfs-events";
import type { GetOrCreatePrebuildEventsActivity } from "./get-or-create-prebuild-events";
import { getOrCreatePrebuildEvents } from "./get-or-create-prebuild-events";
import type { GetPrebuildEventsActivity } from "./get-prebuild-events";
import { getPrebuildEvents } from "./get-prebuild-events";
import type { GetRepositoryProjectsActivity } from "./get-repository-projects";
import { getRepositoryProjects } from "./get-repository-projects";
import type { GetWorkspaceInstanceStatusActivity } from "./get-workspace-instance-status";
import { getWorkspaceInstanceStatus } from "./get-workspace-instance-status";
import type { InitPrebuildEventsActivity } from "./init-prebuild-events";
import { initPrebuildEvents } from "./init-prebuild-events";
import type { LinkGitBranchesActivity } from "./link-git-branches";
import { linkGitBranches } from "./link-git-branches";
import type { SignalWithStartLockWorkflowActivity } from "./mutex/signal-with-start-lock-workflow";
import { signalWithStartLockWorkflow } from "./mutex/signal-with-start-lock-workflow";
import type { PrebuildActivity } from "./prebuild";
import { prebuild } from "./prebuild";
import type { SaveGitRepoConnectionStatusActivity } from "./save-git-repo-connection-status";
import { saveGitRepoConnectionStatus } from "./save-git-repo-connection-status";
import type { StartWorkspaceActivity } from "./start-workspace";
import { startWorkspace } from "./start-workspace";
import type { StopWorkspaceActivity } from "./stop-workspace";
import { stopWorkspace } from "./stop-workspace";
import type { CreateActivity } from "./types";
import type { UpdateGitBranchesAndObjectsActivity } from "./update-git-branches-and-objects";
import { updateGitBranchesAndObjects } from "./update-git-branches-and-objects";
import type { WaitForBuildfsActivity } from "./wait-for-buildfs";
import { waitForBuildfs } from "./wait-for-buildfs";
import type { CleanUpWorkspaceInstanceLocalActivity } from "./workspace/clean-up-workspace-instance";
import { cleanUpWorkspaceInstanceLocal } from "./workspace/clean-up-workspace-instance";

export interface Activities {
  fetchRepository: FetchRepositoryActivity;
  buildfs: BuildfsActivity;
  checkoutAndInspect: CheckoutAndInspectActivity;
  prebuild: PrebuildActivity;
  cancelPrebuilds: CancelPrebuildsActivity;
  changePrebuildEventStatus: ChangePrebuildEventStatusActivity;
  createWorkspace: CreateWorkspaceActivity;
  startWorkspace: StartWorkspaceActivity;
  stopWorkspace: StopWorkspaceActivity;
  getOrCreateBuildfsEvents: GetOrCreateBuildfsEventsActivity;
  createPrebuildFiles: CreatePrebuildFilesActivity;
  getWorkspaceInstanceStatus: GetWorkspaceInstanceStatusActivity;
  addProjectAndRepository: AddProjectAndRepositoryActivity;
  updateGitBranchesAndObjects: UpdateGitBranchesAndObjectsActivity;
  getDefaultBranch: GetDefaultBranchActivity;
  getRepositoryProjects: GetRepositoryProjectsActivity;
  deleteWorkspace: DeleteWorkspaceActivity;
  getOrCreatePrebuildEvents: GetOrCreatePrebuildEventsActivity;
  initPrebuildEvents: InitPrebuildEventsActivity;
  getPrebuildEvents: GetPrebuildEventsActivity;
  linkGitBranches: LinkGitBranchesActivity;
  waitForBuildfs: WaitForBuildfsActivity;
  reservePrebuildEvent: ReservePrebuildEventActivity;
  removePrebuildEventReservation: RemovePrebuildEventReservationActivity;
  waitForPrebuildEventReservations: WaitForPrebuildEventReservationsActivity;
  markPrebuildEventAsArchived: MarkPrebuildEventAsArchivedActivity;
  deleteLocalPrebuildEventFiles: DeleteLocalPrebuildEventFilesActivity;
  deleteRemovablePrebuildEvents: DeleteRemovablePrebuildEventsActivity;
  getArchivablePrebuildEvents: GetArchivablePrebuildEventsActivity;
  saveGitRepoConnectionStatus: SaveGitRepoConnectionStatusActivity;
  cleanUpAfterPrebuildError: CleanUpAfterPrebuildErrorActivity;
  cleanUpWorkspaceInstanceLocal: CleanUpWorkspaceInstanceLocalActivity;
  signalWithStartLockWorkflow: SignalWithStartLockWorkflowActivity;
}

export interface ActivityArgs {
  injector: AgentInjector;
  db: Prisma.NonTransactionClient;
}

export type ActivitiesCreateFns = {
  [K in keyof Activities]: CreateActivity<Activities[K]>;
};

export const createActivities = async (
  injector: AgentInjector,
  db: Prisma.NonTransactionClient,
): Promise<Activities> => {
  const fns: ActivitiesCreateFns = {
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
    linkGitBranches,
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
  };

  return Object.fromEntries(
    Object.entries(fns).map(([name, fn]) => {
      return [name, fn({ injector, db })] as const;
    }),
  ) as any;
};
