import type { Project, GitRepository } from "@prisma/client";
import {
  proxyActivities,
  startChild,
  executeChild,
  sleep,
  continueAsNew,
  ParentClosePolicy,
} from "@temporalio/workflow";

import { withLock } from "./mutex";
import { runBuildfsAndPrebuilds } from "./prebuild";
import { getArchivePrebuildLockId } from "./utils";

import type { Activities } from "~/agent/activities/list";
import { parseWorkflowError } from "~/agent/workflows-utils";
import { retryWorkflow, waitForPromisesWorkflow } from "~/temporal/utils";
import { numericSort } from "~/utils.shared";

export { lockWorkflow } from "./mutex";
export { runSharedWorkflow } from "./shared-workflow";
export {
  runPrebuild,
  runBuildfs,
  scheduleNewPrebuild,
  runFetchRepository,
  runCheckoutAndInspect,
  runSingleBuildfsAndPrebuild,
} from "./prebuild";
export {
  runCreateWorkspace,
  runStartWorkspace,
  runStopWorkspace,
  monitorWorkspaceInstance,
  runDeleteWorkspace,
} from "./workspace";

export { runBuildfsAndPrebuilds };

const {
  getRepositoryProjects,
  updateGitBranchesAndObjects,
  getOrCreatePrebuildEvents,
  getDefaultBranch,
  saveGitRepoConnectionStatus,
  markPrebuildEventAsArchived,
  deleteRemovablePrebuildEvents,
  getArchivablePrebuildEvents,
  addProjectAndRepository,
  reservePrebuildEvent,
  getProjectsRepository,
} = proxyActivities<Activities>({
  startToCloseTimeout: "15 seconds",
  retry: {
    maximumAttempts: 1,
  },
});

const { deleteLocalPrebuildEventFiles, waitForPrebuildEventReservations } =
  proxyActivities<Activities>({
    startToCloseTimeout: "1 hour",
    heartbeatTimeout: "10 seconds",
    retry: {
      maximumAttempts: 10,
    },
  });

export async function runSyncGitRepository(
  gitRepositoryId: bigint,
  seenProjectIds: Set<bigint>,
): Promise<void> {
  for (let i = 0; i < 1000; i++) {
    try {
      const updates = await withLock(
        { resourceId: getArchivePrebuildLockId(gitRepositoryId) },
        () => updateGitBranchesAndObjects(gitRepositoryId),
      );
      const projects = await getRepositoryProjects(gitRepositoryId);
      const seenProjects = projects.filter((p) => seenProjectIds.has(p.id));
      const newProjects = projects.filter((p) => !seenProjectIds.has(p.id));
      if (newProjects.length > 0) {
        const defaultBranch = await getDefaultBranch(gitRepositoryId);
        if (defaultBranch !== null) {
          for (const p of newProjects) {
            const prebuildEvents = await getOrCreatePrebuildEvents({
              projectId: p.id,
              gitObjectIds: [defaultBranch.gitObjectId],
            });
            const prebuildEvent = prebuildEvents.created[0];
            await startChild(runBuildfsAndPrebuilds, {
              args: [[prebuildEvent.id]],
              parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
            });
          }
          for (const p of newProjects) {
            seenProjectIds.add(p.id);
          }
        }
      }
      if (
        seenProjects.length > 0 &&
        updates.newGitBranches.length + updates.updatedGitBranches.length > 0
      ) {
        const branches = [...updates.newGitBranches, ...updates.updatedGitBranches];
        const gitObjectIds = Array.from(new Set(branches.map((b) => b.gitObjectId))).sort(
          numericSort,
        );
        // TODO: HOC-123 - fix race condition in prebuild archival
        const allPrebuildEvents = await waitForPromisesWorkflow(
          seenProjects.map((p) =>
            getOrCreatePrebuildEvents({
              projectId: p.id,
              gitObjectIds,
            }),
          ),
        );
        const prebuildArgs = allPrebuildEvents.flatMap((prebuildEvents) =>
          prebuildEvents.created.map((e) => e.id),
        );
        await startChild(runBuildfsAndPrebuilds, {
          args: [prebuildArgs],
          parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
        });
      }
      await saveGitRepoConnectionStatus({ gitRepositoryId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      await saveGitRepoConnectionStatus({ gitRepositoryId, error: parseWorkflowError(err) }).catch(
        (err) =>
          // eslint-disable-next-line no-console
          console.error(err),
      );
    }

    await sleep(5000);
  }
  await continueAsNew<typeof runSyncGitRepository>(gitRepositoryId, seenProjectIds);
}

export async function runAddProjectAndRepository(args: {
  gitRepositoryUrl: string;
  projectName: string;
  projectWorkspaceRoot: string;
  projectExternalId?: string;
  sshKeyPairId?: bigint;
}): Promise<{ project: Project; gitRepository: GitRepository }> {
  const result = await addProjectAndRepository(args);
  if (result.gitRepositoryCreated) {
    await startChild(runSyncGitRepository, {
      args: [result.gitRepository.id, new Set<bigint>()],
      parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    });
  }
  await startChild(runMonitorArchivablePrebuilds, {
    workflowId: result.project.archivablePrebuildsMonitoringWorkflowId,
    args: [{ projectId: result.project.id, recentlyArchivedPrebuildEventIds: new Map() }],
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
  });
  return result;
}

/**
 * Here's what this workflow does:
 * 1. Reserve prebuild for archival
 * 2. Wait for other reservations to be removed
 * 3. Delete prebuild files from disk
 * 4. Mark prebuild as archived and remove reservation
 */
export async function runDeletePrebuildFiles(args: { prebuildEventId: bigint }): Promise<void> {
  const oneHour = 60 * 60 * 1000;
  const retry = <T>(fn: () => Promise<T>) =>
    retryWorkflow(fn, { maxRetries: 10, retryIntervalMs: 1000 });

  await retry(() =>
    waitForPrebuildEventReservations({
      prebuildEventId: args.prebuildEventId,
      timeoutMs: oneHour,
    }),
  );
  await deleteLocalPrebuildEventFiles({ prebuildEventId: args.prebuildEventId });
  await retry(() => markPrebuildEventAsArchived({ prebuildEventId: args.prebuildEventId }));
}
/**
 * Here's what this workflow does:
 * 1. Reserve prebuild for archival
 * 2. Schedule a prebuild to delete prebuild files from disk
 */
export async function runArchivePrebuild(args: {
  prebuildEventId: bigint;
  waitForDeletion?: boolean;
  /**
   * If a user were to run this manually without a lock, a somewhat harmless and rare race condition could occur.
   * If a new branch is added to the project's repository, and that branch is pointing to the
   * same git object that the prebuild event that's being archived does, here's what can happen:
   *
   * 1. The branch gets connected to the git object id of the prebuild event
   * 2. The prebuild event is not archived yet, so `getOrCreatePrebuildEvents` run by "runSyncGitRepository" finds it instead of creating a new one
   * 3. Archival of the prebuild event is scheduled manually by the user
   * 4. The prebuild event is archived
   * 5. The new branch doesn't have a prebuild event that can be used to create a new workspace, and a new one is NOT created
   *
   * This is not a big deal, because the user can just schedule a new prebuild for the branch manually.
   * Anyway, this lock is here to prevent this from happening.
   */
  gitRepoIdForLock?: bigint;
}): Promise<void> {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const twentyFourHours = 24 * oneHour;

  const reserve = () =>
    reservePrebuildEvent({
      prebuildEventId: args.prebuildEventId,
      reservationType: "PREBUILD_EVENT_RESERVATION_TYPE_ARCHIVE_PREBUILD",
      validUntil: new Date(now + twentyFourHours),
    });

  if (args.gitRepoIdForLock != null) {
    await withLock({ resourceId: getArchivePrebuildLockId(args.gitRepoIdForLock) }, reserve);
  } else {
    await reserve();
  }

  const execFn = args.waitForDeletion ?? false ? executeChild : startChild;
  await execFn(runDeletePrebuildFiles, {
    args: [args],
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
  });
}

export async function runDeleteRemovablePrebuilds(projectId: bigint): Promise<void> {
  await deleteRemovablePrebuildEvents(projectId);
}

/**
 * Here's what this workflow does in a loop:
 *
 * 1. Get a list of archivable prebuilds
 * 2. Schedule workflows to archive these prebuilds
 * 3. Schedule a workflow to remove archived, removable prebuilds
 */
export async function runMonitorArchivablePrebuilds(args: {
  projectId: bigint;
  recentlyArchivedPrebuildEventIds: Map<bigint, number>;
}): Promise<void> {
  let gitRepoId: bigint | null = null;
  for (let i = 0; i < 1000; i++) {
    try {
      gitRepoId =
        gitRepoId == null
          ? await getProjectsRepository(args.projectId).then((g) => g.id)
          : gitRepoId;

      const now = Date.now();
      // This mutex guards against the following, rare race condition:
      // - let's consider a git commit identified as A
      // - let's consider a branch B that is based on A
      // - let's consider a prebuild for commit A that is in the success state
      // - there are no other branches based on commit A
      // - now someone pushes a commit C to branch B
      // - runSyncGitRepo runs and updates the db
      // - monitorArchivablePrebuilds runs and finds that prebuild for commit A is archivable
      // - at the same time, someone creates branch D based on A
      // - runSyncGitRepo runs and updates the db but does not schedule a prebuild for commit A because there is already a prebuild for A
      // - monitorArchivablePrebuilds archives the prebuild for commit A
      // - branch D has no prebuild for commit A, so a user can't create a workspace for branch D
      await withLock({ resourceId: getArchivePrebuildLockId(gitRepoId!) }, async () => {
        const archivablePrebuildEvents = await getArchivablePrebuildEvents(args.projectId);
        const prebuildEventIdsToArchive = archivablePrebuildEvents
          .map((e) => e.id)
          .filter((id) => !args.recentlyArchivedPrebuildEventIds.has(id));

        await waitForPromisesWorkflow(
          prebuildEventIdsToArchive.map(async (prebuildEventId) => {
            await executeChild(runArchivePrebuild, {
              args: [{ prebuildEventId }],
              parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
            });
            args.recentlyArchivedPrebuildEventIds.set(prebuildEventId, now);
          }),
        );
      });
      const oneHour = 60 * 60 * 1000;
      args.recentlyArchivedPrebuildEventIds = new Map(
        Array.from(args.recentlyArchivedPrebuildEventIds.entries()).filter(([_, timestamp]) => {
          return now - timestamp <= oneHour;
        }),
      );
      await startChild(runDeleteRemovablePrebuilds, {
        args: [args.projectId],
        parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
    const fifteenSeconds = 15 * 1000;
    await sleep(fifteenSeconds);
  }
  await continueAsNew<typeof runMonitorArchivablePrebuilds>(args);
}
