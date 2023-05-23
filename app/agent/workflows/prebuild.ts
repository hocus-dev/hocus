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
import type { GetOrCreateBuildfsEventsReturnType } from "../buildfs.service";
import { HOST_PERSISTENT_DIR } from "../constants";
import { PREBUILD_REPOSITORY_DIR } from "../prebuild-constants";
import { parseWorkflowError } from "../workflows-utils";

import { withSharedWorkflow } from "./shared-workflow";

import type { Activities } from "~/agent/activities/list";
import { retryWorkflow, waitForPromisesWorkflow } from "~/temporal/utils";

const { checkoutAndInspect, fetchRepository, prebuild, createPrebuildFiles } =
  proxyActivities<Activities>({
    startToCloseTimeout: "24 hours",
    heartbeatTimeout: "20 seconds",
    retry: {
      maximumAttempts: 1,
    },
  });

const { buildfs } = proxyActivities<Activities>({
  startToCloseTimeout: "24 hours",
  heartbeatTimeout: "20 seconds",
  retry: {
    maximumAttempts: 10,
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

export async function runFetchRepository(gitRepositoryId: bigint): Promise<void> {
  await fetchRepository(gitRepositoryId);
}

export async function runCheckoutAndInspect(args: {
  gitRepositoryId: bigint;
  outputDrivePath: string;
  targetBranch: string;
  projectConfigPaths: string[];
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
    params: [gitRepositoryId],
  });
  const checkoutFileStem = `${batchId}-${prebuildEvent.gitObject.id}` as const;
  const checkoutPath = `${HOST_PERSISTENT_DIR}/checked-out/${checkoutFileStem}.ext4` as const;
  const inspection = await withSharedWorkflow({
    lockId: `checkout-${checkoutFileStem}`,
    workflow: runCheckoutAndInspect,
    params: [
      {
        gitRepositoryId,
        outputDrivePath: checkoutPath,
        targetBranch: prebuildEvent.gitObject.hash,
        projectConfigPaths: batchProjectConfigPaths,
      },
    ],
  }).then((r) => r[inspectResultIdx]);
  let buildfsEvent: GetOrCreateBuildfsEventsReturnType | null = null;
  if (inspection != null) {
    const buildfsEventsArgs = {
      prebuildEventId: prebuildEvent.id,
      projectId: prebuildEvent.project.id,
      contextPath: inspection.projectConfig.image.buildContext,
      dockerfilePath: inspection.projectConfig.image.file,
      cacheHash: inspection.imageFileHash,
      outputFilePath: `${HOST_PERSISTENT_DIR}/buildfs/${uuid4()}.ext4` as const,
      projectFilePath: checkoutPath,
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
      params: [buildfsEvent.event.id],
    });
    if (!buildSuccessful) {
      throw new ApplicationFailure(
        `Buildfs failed. Project root dir path: "${prebuildEvent.project.rootDirectoryPath}", checkout drive path: "${checkoutPath}": ${error}`,
      );
    }
  }
  await executeChild(runPrebuild, {
    args: [prebuildEvent.id, checkoutPath],
  });
}

export async function runSingleBuildfsAndPrebuild(args: {
  prebuildEventId: bigint;
  batch?: {
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
    const errorMessage = parseWorkflowError(err);
    await retryWorkflow(
      () => cleanUpAfterPrebuildError({ prebuildEventIds: [args.prebuildEventId], errorMessage }),
      {
        retryIntervalMs: 1000,
        isExponential: true,
        maxRetries: 6,
      },
    );
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
      }),
    ),
  ).catch(() => {
    // Ignore errors, they will be handled by the children.
  });
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
  const prebuildWorkflowId = uuid4();
  await startChild(runSingleBuildfsAndPrebuild, {
    args: [{ prebuildEventId: prebuildEvent.id }],
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    workflowId: prebuildWorkflowId,
  });
  return { prebuildEvent, prebuildWorkflowId };
}
