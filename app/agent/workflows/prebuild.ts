import type { PrebuildEvent } from "@prisma/client";
import {
  proxyActivities,
  uuid4,
  executeChild,
  ApplicationFailure,
  startChild,
  ParentClosePolicy,
  CancellationScope,
  ActivityCancellationType,
} from "@temporalio/workflow";
import path from "path-browserify";

import type { CheckoutAndInspectResult } from "../activities-types";
import type { GetOrCreateBuildfsEventsReturnType } from "../buildfs.service";
import { PREBUILD_REPOSITORY_DIR } from "../prebuild-constants";
import { parseWorkflowError } from "../workflows-utils";

import { withSharedWorkflow } from "./shared-workflow";

import type { Activities } from "~/agent/activities/list";
import { retryWorkflow, waitForPromisesWorkflow } from "~/temporal/utils";

const { checkoutAndInspect, fetchRepository, prebuild, createPrebuildImages } =
  proxyActivities<Activities>({
    startToCloseTimeout: "24 hours",
    heartbeatTimeout: "20 seconds",
    retry: {
      maximumAttempts: 1,
    },
    cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
  });

const { buildfs } = proxyActivities<Activities>({
  startToCloseTimeout: "24 hours",
  heartbeatTimeout: "20 seconds",
  retry: {
    maximumAttempts: 10,
  },
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
});

const { createPrebuildEvent, removeContentWithPrefix } = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
  heartbeatTimeout: "5 seconds",
  retry: {
    maximumAttempts: 10,
  },
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
});

const {
  getOrCreateBuildfsEvents,
  getPrebuildEvents,
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
  checkoutOutputId: string,
  tmpContentPrefix: string,
): Promise<{ buildSuccessful: boolean; error?: string }> {
  try {
    return await buildfs({ buildfsEventId, checkoutOutputId, tmpContentPrefix });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return { buildSuccessful: false, error: parseWorkflowError(err) };
  }
}

export async function runPrebuild(
  prebuildEventId: bigint,
  checkoutOutputId: string,
  tmpContentPrefix: string,
): Promise<void> {
  await createPrebuildImages({
    prebuildEventId,
  });
  const prebuildOutput = await prebuild({ prebuildEventId, checkoutOutputId, tmpContentPrefix });
  const prebuildTasksFailed = prebuildOutput.some((o) => o.status === "VM_TASK_STATUS_ERROR");
  await changePrebuildEventStatus(
    prebuildEventId,
    prebuildTasksFailed ? "PREBUILD_EVENT_STATUS_ERROR" : "PREBUILD_EVENT_STATUS_SUCCESS",
  );
}

export async function runFetchRepository(
  gitRepositoryId: bigint,
  tmpContentPrefix: string,
): Promise<void> {
  await fetchRepository(gitRepositoryId, tmpContentPrefix);
}

export async function runCheckoutAndInspect(args: {
  gitRepositoryId: bigint;
  outputId: string;
  targetBranch: string;
  projectConfigPaths: string[];
  tmpContentPrefix: string;
}): Promise<CheckoutAndInspectResult[]> {
  return await checkoutAndInspect(args);
}

async function runSingleBuildfsAndPrebuildInner(
  prebuildEventId: bigint,
  batchId: string,
  /**
   * All the rootDirectoryPaths of projects in the batch. This will be
   * removed when we rewrite checkoutAndInspect.
   */
  batchProjectConfigPaths: string[],
): Promise<void> {
  const [prebuildEvent] = await getPrebuildEvents([prebuildEventId]);
  const gitRepositoryId = prebuildEvent.project.gitRepositoryId;
  if (prebuildEvent.status !== "PREBUILD_EVENT_STATUS_PENDING_INIT") {
    throw new ApplicationFailure("Prebuild event must be in the pending init state");
  }
  const inspectResultIdx = batchProjectConfigPaths.findIndex(
    (p) => p === prebuildEvent.project.rootDirectoryPath,
  );
  if (inspectResultIdx === -1) {
    throw new ApplicationFailure("Project not found in batch");
  }
  await withSharedWorkflow({
    lockId: `fetchrepo-${gitRepositoryId}-${batchId}`,
    workflow: runFetchRepository,
    params: [gitRepositoryId, batchId],
  });
  // Prefixing the outputId with batchId will make it garbage collected after the
  // batch is done.
  const checkoutOutputId = `${batchId}-checkout-${prebuildEvent.gitObject.id}` as const;
  const inspection = await withSharedWorkflow({
    lockId: checkoutOutputId,
    workflow: runCheckoutAndInspect,
    params: [
      {
        gitRepositoryId,
        outputId: checkoutOutputId,
        targetBranch: prebuildEvent.gitObject.hash,
        projectConfigPaths: batchProjectConfigPaths,
        tmpContentPrefix: batchId,
      },
    ],
  }).then((r) => r[inspectResultIdx]);
  if (inspection instanceof Error) {
    throw new ApplicationFailure(`Failed to parse project config:\n${inspection.message}`);
  }
  let buildfsEvent: GetOrCreateBuildfsEventsReturnType | null = null;
  if (inspection != null) {
    const buildfsOutputId = `buildfs-out-${uuid4()}`;
    const buildfsEventsArgs = {
      prebuildEventId: prebuildEvent.id,
      projectId: prebuildEvent.project.id,
      contextPath: inspection.projectConfig.image.buildContext,
      dockerfilePath: inspection.projectConfig.image.file,
      cacheHash: inspection.imageFileHash,
      outputId: buildfsOutputId,
    };
    buildfsEvent = await getOrCreateBuildfsEvents([buildfsEventsArgs]).then((r) => r[0]);
  }
  const initPrebuildEventArgs =
    inspection == null
      ? {
          buildfsEventId: null,
          tasks: [],
          workspaceTasks: [],
        }
      : {
          buildfsEventId: buildfsEvent?.event.id ?? null,
          tasks: inspection.projectConfig.tasks.map((task) => ({
            command: task.prebuild,
            cwd: path.join(PREBUILD_REPOSITORY_DIR, prebuildEvent.project.rootDirectoryPath),
          })),
          workspaceTasks: inspection.projectConfig.tasks.map((task) => ({
            commandShell: task.workspaceShell ?? "bash",
            command: task.workspace,
          })),
        };
  await initPrebuildEvents([{ ...initPrebuildEventArgs, prebuildEventId: prebuildEvent.id }]);
  await changePrebuildEventStatus(prebuildEvent.id, "PREBUILD_EVENT_STATUS_RUNNING");
  if (buildfsEvent != null) {
    const { buildSuccessful, error } = await withSharedWorkflow({
      lockId: `buildfs-${buildfsEvent.event.id}`,
      workflow: runBuildfs,
      params: [buildfsEvent.event.id, checkoutOutputId, batchId],
    });
    if (!buildSuccessful) {
      throw new ApplicationFailure(
        `Buildfs failed. Project root dir path: "${prebuildEvent.project.rootDirectoryPath}", checkout output id: "${checkoutOutputId}": ${error}`,
      );
    }
  }
  await executeChild(runPrebuild, {
    args: [prebuildEvent.id, checkoutOutputId, batchId],
  });
}

export async function runSingleBuildfsAndPrebuild(args: {
  prebuildEventId: bigint;
  batch: {
    id: string;
    projectConfigPaths: string[];
  };
}): Promise<void> {
  const batchId = args.batch?.id ?? uuid4();
  const batchProjectConfigPaths = args.batch?.projectConfigPaths ?? [];

  return await runSingleBuildfsAndPrebuildInner(
    args.prebuildEventId,
    batchId,
    batchProjectConfigPaths,
  ).catch(async (err) => {
    const cancelled = CancellationScope.current().consideredCancelled;
    await CancellationScope.nonCancellable(async () => {
      const errorMessage = parseWorkflowError(err);
      await retryWorkflow(
        () =>
          cleanUpAfterPrebuildError({
            prebuildEventIds: [args.prebuildEventId],
            errorMessage,
            cancelled,
          }),
        {
          retryIntervalMs: 1000,
          isExponential: true,
          maxRetries: 6,
        },
      );
    });
    throw err;
  });
}

export async function runBuildfsAndPrebuilds(prebuildEventIds: bigint[]): Promise<void> {
  const prebuildEvents = await getPrebuildEvents(prebuildEventIds);
  const batch = {
    id: uuid4(),
    projectConfigPaths: prebuildEvents.map((e) => e.project.rootDirectoryPath),
  };
  await waitForPromisesWorkflow(
    prebuildEvents.map((e) =>
      executeChild(runSingleBuildfsAndPrebuild, {
        args: [{ prebuildEventId: e.id, batch }],
        parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
        workflowId: e.workflowId,
      }),
    ),
  ).catch(() => {
    // Ignore errors, they will be handled by the children.
  });
  await removeContentWithPrefix({ prefix: batch.id });
}

export async function scheduleNewPrebuild(args: {
  projectId: bigint;
  gitObjectId: bigint;
}): Promise<{ prebuildEvent: PrebuildEvent; prebuildWorkflowId: string }> {
  const externalId = uuid4();
  const twentyFourHoursInTheFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const prebuildEvent = await createPrebuildEvent({
    ...args,
    externalId,
    archiveAfter: twentyFourHoursInTheFuture,
  });
  await startChild(runSingleBuildfsAndPrebuild, {
    args: [
      {
        prebuildEventId: prebuildEvent.id,
        batch: {
          id: uuid4(),
          projectConfigPaths: [prebuildEvent.project.rootDirectoryPath],
        },
      },
    ],
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    workflowId: prebuildEvent.workflowId,
  });
  return { prebuildEvent, prebuildWorkflowId: prebuildEvent.workflowId };
}
