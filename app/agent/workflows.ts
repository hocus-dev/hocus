import { proxyActivities, uuid4, executeChild } from "@temporalio/workflow";
// the native path module is a restricted import in workflows
import path from "path-browserify";
import { waitForPromisesWorkflow } from "~/temporal/utils";
import {
  bigintOrNullSort,
  bigintSort,
  filterNull,
  mapOverNull,
  unwrap,
  groupBy,
} from "~/utils.shared";

import type { createActivities } from "./activities";
import { HOST_PERSISTENT_DIR } from "./constants";
import { PREBUILD_REPOSITORY_DIR } from "./prebuild-constants";

type Activites = Awaited<ReturnType<typeof createActivities>>;
const {
  checkoutAndInspect,
  getProjectsAndGitObjects,
  fetchRepository,
  getOrCreateBuildfsEvents,
  createPrebuildEvents,
  buildfs,
  prebuild,
  createPrebuildFiles,
} = proxyActivities<Activites>({
  // Setting this too low may cause activities such as buildfs to fail.
  // Buildfs in particular waits on a file lock to obtain a lock on its
  // project filesystem, so if several buildfs activities for the same project
  // are running at the same time, it may take a long time for all of them
  // to finish.
  startToCloseTimeout: "10 minutes",
  retry: {
    maximumAttempts: 1,
  },
});

export async function runBuildfsAndPrebuilds(
  gitRepositoryId: bigint,
  branches: { gitBranchId: bigint; gitObjectId: bigint }[],
): Promise<void> {
  const gitObjectIds = Array.from(new Set(branches.map((branch) => branch.gitObjectId)));
  // to make order deterministic
  gitObjectIds.sort();
  const { projects, gitObjects } = await getProjectsAndGitObjects(gitRepositoryId, gitObjectIds);
  gitObjects.sort((a, b) => bigintSort(a.id, b.id));
  projects.sort((a, b) => bigintSort(a.id, b.id));
  await fetchRepository(gitRepositoryId);
  const checkedOutPaths = gitObjects.map(
    (o) => `${HOST_PERSISTENT_DIR}/checked-out/${o.hash}.ext4` as const,
  );
  const checkedOutResults = await waitForPromisesWorkflow(
    checkedOutPaths.map((outputPath, idx) =>
      checkoutAndInspect({
        gitRepositoryId,
        outputDrivePath: outputPath,
        targetBranch: gitObjects[idx].hash,
        projectConfigPaths: projects.map((project) => project.rootDirectoryPath),
      }),
    ),
  );
  const buildfsEventsArgs = filterNull(
    checkedOutResults.flatMap((results, idx) => {
      return mapOverNull(results, ({ projectConfig, imageFileHash }, projectIdx) => {
        return {
          projectId: projects[projectIdx].id,
          contextPath: projectConfig.image.buildContext,
          dockerfilePath: projectConfig.image.file,
          cacheHash: imageFileHash,
          gitObjectIdx: idx,
          projectIdx,
          outputFilePath: `${HOST_PERSISTENT_DIR}/buildfs/${uuid4()}.ext4` as const,
          projectFilePath: checkedOutPaths[idx],
        };
      });
    }),
  );
  const buildfsEvents = await getOrCreateBuildfsEvents(buildfsEventsArgs);
  const gitObjectIdsToBranches = groupBy(
    branches,
    (b) => b.gitObjectId,
    (b) => b.gitBranchId,
  );
  const prebuildEventsArgs = checkedOutResults.map((results, idx) => {
    return results.map((result, projectIdx) => {
      return {
        projectId: projects[projectIdx].id,
        gitObjectId: gitObjects[idx].id,
        buildfsEventId: null as bigint | null,
        sourceProjectDrivePath: checkedOutPaths[idx],
        gitBranchIds: unwrap(gitObjectIdsToBranches.get(gitObjects[idx].id)),
        tasks:
          result === null
            ? []
            : result.projectConfig.tasks.map((task) => ({
                command: task.init,
                cwd: path.join(PREBUILD_REPOSITORY_DIR, projects[projectIdx].rootDirectoryPath),
              })),
        workspaceTasks:
          result === null ? [] : result.projectConfig.tasks.map((task) => task.command),
      };
    });
  });
  for (const [idx, args] of buildfsEventsArgs.entries()) {
    prebuildEventsArgs[args.gitObjectIdx][args.projectIdx].buildfsEventId =
      buildfsEvents[idx].event.id;
  }
  const prebuildEventsArgsFlat = prebuildEventsArgs.flat();
  const prebuildEvents = await createPrebuildEvents(prebuildEventsArgsFlat);
  const prebuildEventIdToProjectDrivePath = new Map(
    prebuildEventsArgsFlat.map((args, idx) => [
      prebuildEvents[idx].id,
      args.sourceProjectDrivePath,
    ]),
  );
  const buildfsEventsToPrebuilds = Array.from(
    groupBy(
      prebuildEvents,
      (e) => e.buildfsEventId,
      (e) => e,
    ).entries(),
  ).sort(([a, _1], [b, _2]) => bigintOrNullSort(a, b));

  await waitForPromisesWorkflow(
    buildfsEventsToPrebuilds.map(async ([buildfsEventId, prebuildEvents]) => {
      if (buildfsEventId != null) {
        const buildfsResult = await executeChild(runBuildfs, { args: [buildfsEventId] });
        if (!buildfsResult.buildSuccessful) {
          // TODO: cancel prebuilds
          throw new Error("Buildfs failed");
        }
      }
      await waitForPromisesWorkflow(
        prebuildEvents.map(async (prebuildEvent) =>
          executeChild(runPrebuild, {
            args: [
              prebuildEvent.id,
              unwrap(prebuildEventIdToProjectDrivePath.get(prebuildEvent.id)),
            ],
          }),
        ),
      );
    }),
  );
}

export async function runBuildfs(buildfsEventId: bigint): Promise<{ buildSuccessful: boolean }> {
  return await buildfs({ buildfsEventId, outputDriveMaxSizeMiB: 10000 });
}

export async function runPrebuild(
  prebuildEventId: bigint,
  sourceProjectDrivePath: string,
): Promise<void> {
  await createPrebuildFiles({
    prebuildEventId,
    sourceProjectDrivePath,
  });
  await prebuild({ prebuildEventId });
}
