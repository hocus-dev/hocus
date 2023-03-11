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
  makeMap,
  displayError,
} from "~/utils.shared";

import type { Activities } from "./activities";
import { HOST_PERSISTENT_DIR } from "./constants";
import { PREBUILD_REPOSITORY_DIR } from "./prebuild-constants";
import { ArbitraryKeyMap } from "./utils/arbitrary-key-map.server";
import type { BFSPWorkflowPhase, BFSPWorkflowState } from "./workflows-utils";

const { defaultWorkflowLogger: logger } = proxySinks();

const {
  checkoutAndInspect,
  getProjectsAndGitObjects,
  fetchRepository,
  getOrCreateBuildfsEvents,
  createPrebuildEvents,
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
export async function runBuildfsAndPrebuilds(
  targets: {
    projectId: bigint;
    branches: { gitBranchId: bigint; gitObjectId: bigint }[];
  }[],
): Promise<void> {
  if (targets.length === 0) {
    return;
  }
  const state1: BFSPWorkflowState<typeof BFSPWorkflowPhase.START> = new ArbitraryKeyMap(
    (key) => `${key.projectId}-${key.gitObjectId}`,
  );
  for (const target of targets) {
    for (const branch of target.branches) {
      const key = { projectId: target.projectId, gitObjectId: branch.gitObjectId };
      const value = state1.get(key);
      if (value != null) {
        value.gitBranchIds.push(branch.gitBranchId);
      } else {
        state1.set(key, { gitBranchIds: [branch.gitBranchId] });
      }
    }
  }

  const gitObjectIds = Array.from(new Set(state1.keys().map((key) => key.gitObjectId)));
  // to make order deterministic
  gitObjectIds.sort(numericSort);
  const { projects, gitObjects } = await getProjectsAndGitObjects(
    targets.map((t) => t.projectId),
    gitObjectIds,
  );
  gitObjects.sort((a, b) => numericSort(a.id, b.id));
  projects.sort((a, b) => numericSort(a.id, b.id));

  const gitObjectsById = makeMap(gitObjects, (o) => o.id);
  const projectsById = makeMap(projects, (p) => p.id);

  const state2 = state1 as BFSPWorkflowState<typeof BFSPWorkflowPhase.AFTER_DB_FETCH>;
  for (const key of state2.keys()) {
    const { projectId, gitObjectId } = key;
    const stateElement = unwrap(state2.get(key));
    stateElement.gitObject = unwrap(gitObjectsById.get(gitObjectId));
    stateElement.project = unwrap(projectsById.get(projectId));
  }

  const gitRepositoryId = projects[0].gitRepositoryId;
  if (!projects.every((project) => project.gitRepositoryId === gitRepositoryId)) {
    throw new ApplicationFailure("All projects must be from the same repository");
  }

  await fetchRepository(gitRepositoryId);

  const gitObjectIdToCheckOutPath = new Map(
    gitObjects.map((o) => [o.id, `${HOST_PERSISTENT_DIR}/checked-out/${o.hash}.ext4` as const]),
  );
  const gitObjectIdsAndProjectIds = Array.from(
    groupBy(
      state2.keys(),
      (key) => key.gitObjectId,
      (key) => key.projectId,
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

  const state3 = state2 as BFSPWorkflowState<typeof BFSPWorkflowPhase.AFTER_CHECKOUT>;
  for (const [
    gitObjectIdIdx,
    [gitObjectId, gitObjectProjectIds],
  ] of gitObjectIdsAndProjectIds.entries()) {
    for (const [projectIdIdx, projectId] of gitObjectProjectIds.entries()) {
      const checkoutResult = checkedOutResults[gitObjectIdIdx][projectIdIdx];
      const stateElement = unwrap(state3.get({ projectId, gitObjectId }));
      stateElement.inspection = checkoutResult;
    }
  }

  const buildfsEventsArgs = filterNull(
    state3.sortedValues().map((stateElement) => {
      const { inspection, gitObject, project } = stateElement;
      if (inspection === null) {
        return null;
      }
      return {
        projectId: project.id,
        gitObjectId: gitObject.id,
        contextPath: inspection.projectConfig.image.buildContext,
        dockerfilePath: inspection.projectConfig.image.file,
        cacheHash: inspection.imageFileHash,
        outputFilePath: `${HOST_PERSISTENT_DIR}/buildfs/${uuid4()}.ext4` as const,
        projectFilePath: unwrap(gitObjectIdToCheckOutPath.get(gitObject.id)),
      };
    }),
  );

  const buildfsEvents = await getOrCreateBuildfsEvents(buildfsEventsArgs);
  const state4 = state3 as BFSPWorkflowState<typeof BFSPWorkflowPhase.AFTER_BUILDFS_EVENTS>;
  for (const [idx, args] of buildfsEventsArgs.entries()) {
    const stateElement = unwrap(
      state4.get({ projectId: args.projectId, gitObjectId: args.gitObjectId }),
    );
    stateElement.buildfsEvent = buildfsEvents[idx];
  }

  const prebuildEventsArgs = state4.sortedValues().map((stateElement) => {
    const { inspection, gitObject, project, buildfsEvent, gitBranchIds } = stateElement;
    const [buildfsEventId, tasks, workspaceTasks] =
      inspection === null
        ? [null, [], []]
        : [
            unwrap(buildfsEvent).event.id,
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
      projectId: project.id,
      gitObjectId: gitObject.id,
      buildfsEventId,
      sourceProjectDrivePath: unwrap(gitObjectIdToCheckOutPath.get(gitObject.id)),
      gitBranchIds,
      tasks,
      workspaceTasks,
    };
  });

  const prebuildEvents = await createPrebuildEvents(prebuildEventsArgs);
  const state5 = state4 as BFSPWorkflowState<typeof BFSPWorkflowPhase.AFTER_PREBUILD_EVENTS>;
  for (const [idx, args] of prebuildEventsArgs.entries()) {
    const stateElement = unwrap(
      state5.get({ projectId: args.projectId, gitObjectId: args.gitObjectId }),
    );
    stateElement.prebuildEvent = prebuildEvents[idx];
    stateElement.sourceProjectDrivePath = args.sourceProjectDrivePath;
  }

  const buildfsEventsToStateElements = Array.from(
    groupBy(
      state5.sortedValues(),
      (e) => e.buildfsEvent?.event.id ?? null,
      (e) => e,
    ).entries(),
  ).sort(([a, _1], [b, _2]) => numericOrNullSort(a, b));

  await waitForPromisesWorkflow(
    buildfsEventsToStateElements.map(async ([buildfsEventId, stateElements]) => {
      await waitForPromisesWorkflow(
        stateElements.map((e) =>
          changePrebuildEventStatus(e.prebuildEvent.id, "PREBUILD_EVENT_STATUS_RUNNING"),
        ),
      );
      if (buildfsEventId != null) {
        // TODO HOC-64: don't run buildfs if event was found and is already successful
        // also wait for buildfs event to be completed if it's already running
        const buildfsResult = await executeChild(runBuildfs, { args: [buildfsEventId] });
        if (!buildfsResult.buildSuccessful) {
          await cancelPrebuilds(stateElements.map((e) => e.prebuildEvent.id));
          return;
        }
      }
      await waitForPromisesWorkflow(
        stateElements.map(async (e) =>
          executeChild(runPrebuild, {
            args: [e.prebuildEvent.id, unwrap(e.sourceProjectDrivePath)],
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
  const workspace = await createWorkspace(args);
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
      const _updates = await updateGitBranchesAndObjects(gitRepositoryId);
      const projects = await getRepositoryProjects(gitRepositoryId);
      const _seenProjects = projects.filter((p) => seenProjectIds.has(p.id));
      const newProjects = projects.filter((p) => !seenProjectIds.has(p.id));
      if (newProjects.length > 0) {
        const defaultBranch = await getDefaultBranch(gitRepositoryId);
        if (defaultBranch !== null) {
          for (const p of newProjects) {
            await executeChild(runBuildfsAndPrebuilds, {
              args: [
                [
                  {
                    projectId: p.id,
                    branches: [
                      { gitBranchId: defaultBranch.id, gitObjectId: defaultBranch.gitObjectId },
                    ],
                  },
                ],
              ],
              parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
            });
          }
          for (const p of newProjects) {
            seenProjectIds.add(p.id);
          }
        }
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
