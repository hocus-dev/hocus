import type { Project, GitRepository } from "@prisma/client";
import {
  proxyActivities,
  startChild,
  sleep,
  continueAsNew,
  ParentClosePolicy,
} from "@temporalio/workflow";

import { lockWorkflow } from "./mutex";
import { testLock } from "./mutex/test-workflow";
import { runBuildfsAndPrebuilds, runPrebuild, runBuildfs, scheduleNewPrebuild } from "./prebuild";
import {
  runCreateWorkspace,
  runStartWorkspace,
  runStopWorkspace,
  monitorWorkspaceInstance,
  runDeleteWorkspace,
} from "./workspace";

import type { Activities } from "~/agent/activities/list";
import { parseWorkflowError } from "~/agent/workflows-utils";
import { retryWorkflow, waitForPromisesWorkflow } from "~/temporal/utils";
import { numericSort } from "~/utils.shared";

export {
  runBuildfsAndPrebuilds,
  runPrebuild,
  runBuildfs,
  runCreateWorkspace,
  runStartWorkspace,
  runStopWorkspace,
  monitorWorkspaceInstance,
  runDeleteWorkspace,
  lockWorkflow,
  testLock,
  scheduleNewPrebuild,
};

const {
  addProjectAndRepository,
  reservePrebuildEvent,
  waitForPrebuildEventReservations,
  markPrebuildEventAsArchived,
  deleteLocalPrebuildEventFiles,
  deleteRemovablePrebuildEvents,
  getArchivablePrebuildEvents,
} = proxyActivities<Activities>({
  // Setting this too low may cause activities such as buildfs to fail.
  // Buildfs in particular waits on a file lock to obtain a lock on its
  // project filesystem, so if several buildfs activities for the same project
  // are running at the same time, it may take a long time for all of them
  // to finish.
  startToCloseTimeout: "24 hours",
  retry: {
    maximumAttempts: 1,
  },
});

const {
  getRepositoryProjects,
  updateGitBranchesAndObjects,
  getOrCreatePrebuildEvents,
  getDefaultBranch,
  saveGitRepoConnectionStatus,
} = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 1,
  },
});

export async function runSyncGitRepository(
  gitRepositoryId: bigint,
  seenProjectIds: Set<bigint>,
): Promise<void> {
  for (let i = 0; i < 1000; i++) {
    try {
      const updates = await updateGitBranchesAndObjects(gitRepositoryId);
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
export async function runArchivePrebuild(args: { prebuildEventId: bigint }): Promise<void> {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const twentyFourHours = 24 * oneHour;
  const retry = <T>(fn: () => Promise<T>) =>
    retryWorkflow(fn, { maxRetries: 10, retryIntervalMs: 1000 });

  await reservePrebuildEvent({
    prebuildEventId: args.prebuildEventId,
    reservationType: "PREBUILD_EVENT_RESERVATION_TYPE_ARCHIVE_PREBUILD",
    validUntil: new Date(now + twentyFourHours),
  });
  await retry(() =>
    waitForPrebuildEventReservations({
      prebuildEventId: args.prebuildEventId,
      timeoutMs: oneHour,
    }),
  );
  await retry(() => deleteLocalPrebuildEventFiles({ prebuildEventId: args.prebuildEventId }));
  await retry(() => markPrebuildEventAsArchived({ prebuildEventId: args.prebuildEventId }));
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
  for (let i = 0; i < 1000; i++) {
    try {
      const archivablePrebuildEvents = await getArchivablePrebuildEvents(args.projectId);
      const prebuildEventIdsToArchive = archivablePrebuildEvents
        .map((e) => e.id)
        .filter((id) => !args.recentlyArchivedPrebuildEventIds.has(id));
      const now = Date.now();
      for (const prebuildEventId of prebuildEventIdsToArchive) {
        await startChild(runArchivePrebuild, {
          args: [{ prebuildEventId }],
          parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
        });
        args.recentlyArchivedPrebuildEventIds.set(prebuildEventId, now);
      }
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
