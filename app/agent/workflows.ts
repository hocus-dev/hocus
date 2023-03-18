import type { Workspace, WorkspaceInstance, Project, GitRepository } from "@prisma/client";
import {
  proxyActivities,
  uuid4,
  executeChild,
  startChild,
  sleep,
  continueAsNew,
  ApplicationFailure,
  ParentClosePolicy,
  proxySinks,
} from "@temporalio/workflow";
// the native path module is a restricted import in workflows
import path from "path-browserify";
import { retryWorkflow, waitForPromisesWorkflow } from "~/temporal/utils";
import {
  numericOrNullSort,
  numericSort,
  filterNull,
  unwrap,
  groupBy,
  displayError,
} from "~/utils.shared";

import type { CheckoutAndInspectResult } from "./activities-types";
import type { Activities } from "./activities/list";
import { HOST_PERSISTENT_DIR } from "./constants";
import { PREBUILD_REPOSITORY_DIR } from "./prebuild-constants";
import { ArbitraryKeyMap } from "./utils/arbitrary-key-map.server";

const { defaultWorkflowLogger: logger } = proxySinks();

const {
  checkoutAndInspect,
  fetchRepository,
  getOrCreateBuildfsEvents,
  getOrCreatePrebuildEvents,
  getPrebuildEvents,
  buildfs,
  prebuild,
  createPrebuildFiles,
  createWorkspace,
  startWorkspace,
  stopWorkspace,
  cancelPrebuilds,
  changePrebuildEventStatus,
  getWorkspaceInstanceStatus,
  addProjectAndRepository,
  getRepositoryProjects,
  updateGitBranchesAndObjects,
  getDefaultBranch,
  deleteWorkspace,
  initPrebuildEvents,
  linkGitBranches,
  waitForBuildfs,
  reservePrebuildEvent,
  removePrebuildEventReservation,
  waitForPrebuildEventReservations,
  markPrebuildEventAsArchived,
  deleteLocalPrebuildEventFiles,
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

/**
 * WARNING: This is the hairiest function in the codebase.
 * Prepare to spend a while understanding it.
 *
 * All projects must be from the same repository, otherwise
 * this workflow will fail.
 *
 * Here's what this workflow does:
 *
 * - Fetch the repository
 * - Checkout the git objects and inspect the project configs
 * - Create buildfs events in the db
 * - Create prebuild events in the db
 * - Run buildfs tasks
 * - Run prebuild tasks
 */
export async function runBuildfsAndPrebuilds(prebuildEventIds: bigint[]): Promise<void> {
  if (prebuildEventIds.length === 0) {
    return;
  }
  const prebuildEvents = await getPrebuildEvents(prebuildEventIds);
  const gitRepositoryId = prebuildEvents[0].project.gitRepositoryId;
  if (!prebuildEvents.every((e) => e.project.gitRepositoryId === gitRepositoryId)) {
    throw new ApplicationFailure("All projects must be from the same repository");
  }
  if (!prebuildEvents.every((e) => e.status === "PREBUILD_EVENT_STATUS_PENDING_INIT")) {
    throw new ApplicationFailure("All prebuild events must be in the pending init state");
  }
  const projectAndGitObjectIdToPrebuildEvent = new ArbitraryKeyMap<
    { projectId: bigint; gitObjectId: bigint },
    typeof prebuildEvents[0]
  >(({ projectId, gitObjectId }) => `${projectId}-${gitObjectId}`);
  for (const prebuildEvent of prebuildEvents) {
    const key = { projectId: prebuildEvent.projectId, gitObjectId: prebuildEvent.gitObjectId };
    if (projectAndGitObjectIdToPrebuildEvent.has(key)) {
      throw new ApplicationFailure(
        "There are multiple prebuild events for the same project and git object",
      );
    }
    projectAndGitObjectIdToPrebuildEvent.set(key, prebuildEvent);
  }

  await fetchRepository(gitRepositoryId);
  const gitObjectsById = new Map(prebuildEvents.map((e) => [e.gitObjectId, e.gitObject]));
  const projectsById = new Map(prebuildEvents.map((e) => [e.projectId, e.project]));

  const checkoutId = uuid4();
  const gitObjectIdToCheckOutPath = new Map(
    Array.from(gitObjectsById.values()).map((o) => [
      o.id,
      `${HOST_PERSISTENT_DIR}/checked-out/${checkoutId}-${o.id}.ext4` as const,
    ]),
  );
  const gitObjectIdsAndProjectIds = Array.from(
    groupBy(
      prebuildEvents,
      (e) => e.gitObjectId,
      (e) => e.projectId,
    ).entries(),
  )
    .map(
      ([gitObjectId, projectIds]) =>
        [gitObjectId, Array.from(new Set(projectIds).values()).sort(numericSort)] as const,
    )
    .sort(([a], [b]) => numericSort(a, b));

  const checkedOutResults = await waitForPromisesWorkflow(
    gitObjectIdsAndProjectIds.map(([gitObjectId, gitObjectProjectIds]) => {
      const gitObject = unwrap(gitObjectsById.get(gitObjectId));
      const projectConfigPaths = gitObjectProjectIds.map(
        (projectId) => unwrap(projectsById.get(projectId)).rootDirectoryPath,
      );
      const outputDrivePath = unwrap(gitObjectIdToCheckOutPath.get(gitObjectId));

      return checkoutAndInspect({
        gitRepositoryId,
        outputDrivePath,
        targetBranch: gitObject.hash,
        projectConfigPaths,
      });
    }),
  );

  const prebuildEventsWithInspection: (typeof prebuildEvents[0] & {
    inspection: CheckoutAndInspectResult;
  })[] = [];
  for (const [
    gitObjectIdIdx,
    [gitObjectId, gitObjectProjectIds],
  ] of gitObjectIdsAndProjectIds.entries()) {
    for (const [projectIdIdx, projectId] of gitObjectProjectIds.entries()) {
      const checkoutResult = checkedOutResults[gitObjectIdIdx][projectIdIdx];
      const prebuildEvent = unwrap(
        projectAndGitObjectIdToPrebuildEvent.get({ projectId, gitObjectId }),
      );
      prebuildEventsWithInspection.push({
        ...prebuildEvent,
        inspection: checkoutResult,
      });
    }
  }
  prebuildEventsWithInspection.sort((a, b) => numericSort(a.id, b.id));

  const buildfsEventsArgs = filterNull(
    prebuildEventsWithInspection.map(({ inspection, id, gitObjectId, project }) => {
      if (inspection === null) {
        return null;
      }
      return {
        prebuildEventId: id,
        projectId: project.id,
        contextPath: inspection.projectConfig.image.buildContext,
        dockerfilePath: inspection.projectConfig.image.file,
        cacheHash: inspection.imageFileHash,
        outputFilePath: `${HOST_PERSISTENT_DIR}/buildfs/${uuid4()}.ext4` as const,
        projectFilePath: unwrap(gitObjectIdToCheckOutPath.get(gitObjectId)),
      };
    }),
  );

  const buildfsEvents = await getOrCreateBuildfsEvents(buildfsEventsArgs);
  const buildfsEventByPrebuildEventId = new Map(
    Array.from(buildfsEventsArgs.entries()).map(([idx, e]) => [
      e.prebuildEventId,
      buildfsEvents[idx],
    ]),
  );

  const prebuildEventsArgs = prebuildEventsWithInspection.map((prebuildEvent) => {
    const { inspection, project } = prebuildEvent;
    const buildfsEvent = buildfsEventByPrebuildEventId.get(prebuildEvent.id);

    const [buildfsEventId, tasks, workspaceTasks] =
      inspection === null
        ? [null, [], []]
        : [
            buildfsEvent?.event.id ?? null,
            inspection.projectConfig.tasks.map((task) => ({
              command: task.init,
              cwd: path.join(PREBUILD_REPOSITORY_DIR, project.rootDirectoryPath),
            })),
            inspection.projectConfig.tasks.map((task) => ({
              commandShell: task.commandShell ?? "bash",
              command: task.command,
            })),
          ];
    return {
      prebuildEventId: prebuildEvent.id,
      buildfsEventId,
      tasks,
      workspaceTasks,
    };
  });

  const updatedPrebuildEvents = (await initPrebuildEvents(prebuildEventsArgs)).map((e) => ({
    ...e,
    sourceProjectDrivePath: unwrap(gitObjectIdToCheckOutPath.get(e.gitObjectId)),
  }));
  const buildfsEventIdAndPrebuilds = Array.from(
    groupBy(
      updatedPrebuildEvents,
      (e) => e.buildfsEventId,
      (e) => e,
    ).entries(),
  ).sort(([a], [b]) => numericOrNullSort(a, b));

  await waitForPromisesWorkflow(
    buildfsEventIdAndPrebuilds.map(async ([buildfsEventId, innerPrebuildEvents]) => {
      await waitForPromisesWorkflow(
        innerPrebuildEvents.map((e) =>
          changePrebuildEventStatus(e.id, "PREBUILD_EVENT_STATUS_RUNNING"),
        ),
      );
      if (buildfsEventId != null) {
        const buildfsEvent = unwrap(buildfsEventByPrebuildEventId.get(innerPrebuildEvents[0].id));
        if (buildfsEvent.status === "created") {
          const buildfsResult = await executeChild(runBuildfs, { args: [buildfsEventId] });
          if (!buildfsResult.buildSuccessful) {
            await cancelPrebuilds(innerPrebuildEvents.map((e) => e.id));
            return;
          }
        } else if (buildfsEvent.status === "found") {
          const twoHours = 2 * 1000 * 60 * 60;
          try {
            await waitForBuildfs(buildfsEventId, twoHours);
          } catch {
            await cancelPrebuilds(innerPrebuildEvents.map((e) => e.id));
            return;
          }
        }
      }
      await waitForPromisesWorkflow(
        innerPrebuildEvents.map(async (e) =>
          executeChild(runPrebuild, {
            args: [e.id, unwrap(e.sourceProjectDrivePath)],
          }),
        ),
      );
    }),
  );
}

export async function runBuildfs(buildfsEventId: bigint): Promise<{ buildSuccessful: boolean }> {
  try {
    return await buildfs({ buildfsEventId, outputDriveMaxSizeMiB: 10000 });
  } catch (err) {
    logger.error(displayError(err));
    return { buildSuccessful: false };
  }
}

export async function runPrebuild(
  prebuildEventId: bigint,
  sourceProjectDrivePath: string,
): Promise<void> {
  await createPrebuildFiles({
    prebuildEventId,
    sourceProjectDrivePath,
  });
  const prebuildOutput = await prebuild({ prebuildEventId });
  const prebuildTasksFailed = prebuildOutput.some((o) => o.status === "VM_TASK_STATUS_ERROR");
  await changePrebuildEventStatus(
    prebuildEventId,
    prebuildTasksFailed ? "PREBUILD_EVENT_STATUS_ERROR" : "PREBUILD_EVENT_STATUS_SUCCESS",
  );
}

export async function runCreateWorkspace(args: {
  name: string;
  prebuildEventId: bigint;
  gitBranchId: bigint;
  userId: bigint;
  externalId: string;
  startWorkspace: boolean;
}): Promise<Workspace> {
  const workspace = await (async () => {
    const reservationExternalId = uuid4();
    const now = Date.now();
    try {
      const fifteenMinutes = 1000 * 60 * 15;
      await reservePrebuildEvent({
        prebuildEventId: args.prebuildEventId,
        reservationType: "PREBUILD_EVENT_RESERVATION_TYPE_CREATE_WORKSPACE",
        reservationExternalId,
        validUntil: new Date(now + fifteenMinutes),
      });
      return await createWorkspace(args);
    } finally {
      await retryWorkflow(() => removePrebuildEventReservation(reservationExternalId), {
        maxRetries: 5,
        retryIntervalMs: 1000,
      });
    }
  })();
  if (args.startWorkspace) {
    await startChild(runStartWorkspace, {
      args: [workspace.id],
      workflowId: uuid4(),
      parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    });
  }
  return workspace;
}

export async function runStartWorkspace(workspaceId: bigint): Promise<WorkspaceInstance> {
  const workspaceInstance = await startWorkspace(workspaceId);
  await startChild(monitorWorkspaceInstance, {
    args: [workspaceId, workspaceInstance.id],
    workflowId: workspaceInstance.monitoringWorkflowId,
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
  });
  return workspaceInstance;
}

export async function runStopWorkspace(workspaceId: bigint): Promise<void> {
  return await stopWorkspace(workspaceId);
}

export async function monitorWorkspaceInstance(
  workspaceId: bigint,
  workspaceInstanceId: bigint,
): Promise<void> {
  for (let i = 0; i < 1000; i++) {
    await sleep(5000);
    const status = await retryWorkflow(() => getWorkspaceInstanceStatus(workspaceInstanceId), {
      maxRetries: 10,
      retryIntervalMs: 1000,
    });
    if (status === "removed") {
      return;
    }
    if (status !== "on") {
      await executeChild(runStopWorkspace, { args: [workspaceId] });
      return;
    }
  }
  await continueAsNew<typeof monitorWorkspaceInstance>(workspaceId, workspaceInstanceId);
}

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
              git: [
                {
                  objectId: defaultBranch.gitObjectId,
                  branchIds: [defaultBranch.id],
                },
              ],
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
        const branchesByGitObjectId = groupBy(
          branches,
          (b) => b.gitObjectId,
          (b) => b,
        );
        const branchesByGitObjectIdArray = Array.from(branchesByGitObjectId.entries()).sort(
          ([a], [b]) => numericSort(a, b),
        );
        // TODO: HOC-123 - fix race condition in prebuild archival
        const allPrebuildEvents = await waitForPromisesWorkflow(
          seenProjects.map((p) =>
            getOrCreatePrebuildEvents({
              projectId: p.id,
              git: branchesByGitObjectIdArray.map(([gitObjectId, branches]) => ({
                objectId: gitObjectId,
                branchIds: branches.map((b) => b.id),
              })),
            }),
          ),
        );
        const linkArgs = allPrebuildEvents.flatMap((prebuildEvents) =>
          prebuildEvents.found.map((e) => ({
            prebuildEventId: e.id,
            gitBranchIds: unwrap(branchesByGitObjectId.get(e.gitObjectId)).map((b) => b.id),
          })),
        );
        await linkGitBranches(linkArgs);
        const prebuildArgs = allPrebuildEvents.flatMap((prebuildEvents) =>
          prebuildEvents.created.map((e) => e.id),
        );
        await startChild(runBuildfsAndPrebuilds, {
          args: [prebuildArgs],
          parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }

    await sleep(5000);
  }
  await continueAsNew<typeof runSyncGitRepository>(gitRepositoryId, seenProjectIds);
}

export async function runAddProjectAndRepository(args: {
  gitRepositoryUrl: string;
  projectName: string;
  projectWorkspaceRoot: string;
  sshKeyPairId?: bigint;
}): Promise<{ project: Project; gitRepository: GitRepository }> {
  const result = await addProjectAndRepository(args);
  if (result.gitRepositoryCreated) {
    await startChild(runSyncGitRepository, {
      args: [result.gitRepository.id, new Set<bigint>()],
      parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    });
  }
  return result;
}

export async function runDeleteWorkspace(args: { workspaceId: bigint }): Promise<void> {
  await deleteWorkspace(args.workspaceId);
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

export async function runMonitorPrebuilds(args: {
  projectId: bigint;
  recentlyArchivedPrebuildEventIds: { id: bigint; archivedAt: number }[];
}): Promise<void> {}
