import type { PrebuildEvent } from "@prisma/client";
import {
  proxyActivities,
  uuid4,
  executeChild,
  ApplicationFailure,
  startChild,
  ParentClosePolicy,
} from "@temporalio/workflow";
import path from "path-browserify";

import type { CheckoutAndInspectResult } from "../activities-types";
import { HOST_PERSISTENT_DIR } from "../constants";
import { PREBUILD_REPOSITORY_DIR } from "../prebuild-constants";
import { ArbitraryKeyMap } from "../utils/arbitrary-key-map.server";
import { parseWorkflowError } from "../workflows-utils";

import type { Activities } from "~/agent/activities/list";
import { retryWorkflow, waitForPromisesWorkflow } from "~/temporal/utils";
import { groupBy, numericSort, unwrap, filterNull, numericOrNullSort } from "~/utils.shared";

const {
  checkoutAndInspect,
  fetchRepository,
  buildfs,
  prebuild,
  createPrebuildFiles,
  waitForBuildfs,
} = proxyActivities<Activities>({
  // Setting this too low may cause activities such as buildfs to fail.
  // Buildfs in particular waits on a file lock to obtain a lock on its
  // project filesystem, so if several buildfs activities for the same project
  // are running at the same time, it may take a long time for all of them
  // to finish.
  startToCloseTimeout: "24 hours",
  heartbeatTimeout: "20 seconds",
  retry: {
    maximumAttempts: 1,
  },
});

const { createPrebuildEvent } = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
  heartbeatTimeout: "5 seconds",
  retry: {
    maximumAttempts: 10,
  },
});

const {
  getOrCreateBuildfsEvents,
  getPrebuildEvents,
  cancelPrebuilds,
  changePrebuildEventStatus,
  initPrebuildEvents,
  cleanUpAfterPrebuildError,
} = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 1,
  },
});

export async function runBuildfs(
  buildfsEventId: bigint,
): Promise<{ buildSuccessful: boolean; error?: string }> {
  try {
    return await buildfs({ buildfsEventId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return { buildSuccessful: false, error: parseWorkflowError(err) };
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
async function runBuildfsAndPrebuildsInner(prebuildEventIds: bigint[]): Promise<void> {
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
    (typeof prebuildEvents)[0]
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

  const prebuildEventsWithInspection: ((typeof prebuildEvents)[0] & {
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
              command: task.prebuild,
              cwd: path.join(PREBUILD_REPOSITORY_DIR, project.rootDirectoryPath),
            })),
            inspection.projectConfig.tasks.map((task) => ({
              commandShell: task.workspaceShell ?? "bash",
              command: task.workspace,
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
            await cancelPrebuilds(
              innerPrebuildEvents.map((e) => e.id),
              buildfsResult.error,
            );
            return;
          }
        } else if (buildfsEvent.status === "found") {
          const twoHours = 2 * 1000 * 60 * 60;
          try {
            await waitForBuildfs(buildfsEventId, twoHours);
          } catch (err) {
            await cancelPrebuilds(
              innerPrebuildEvents.map((e) => e.id),
              parseWorkflowError(err),
            );
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

export async function runBuildfsAndPrebuilds(prebuildEventIds: bigint[]): Promise<void> {
  return await runBuildfsAndPrebuildsInner(prebuildEventIds).catch(async (err) => {
    const errorMessage = parseWorkflowError(err);
    await retryWorkflow(() => cleanUpAfterPrebuildError({ prebuildEventIds, errorMessage }), {
      retryIntervalMs: 1000,
      isExponential: true,
      maxRetries: 6,
    });
  });
}

export async function scheduleNewPrebuild(args: {
  projectId: bigint;
  gitObjectId: bigint;
}): Promise<{ prebuildEvent: PrebuildEvent; prebuildWorkflowId: string }> {
  const externalId = uuid4();
  const prebuildEvent = await createPrebuildEvent({
    ...args,
    externalId,
  });
  const prebuildWorkflowId = uuid4();
  await startChild(runBuildfsAndPrebuilds, {
    args: [[prebuildEvent.id]],
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    workflowId: prebuildWorkflowId,
  });
  return { prebuildEvent, prebuildWorkflowId };
}
