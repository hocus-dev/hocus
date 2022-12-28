import { proxyActivities, uuid4 } from "@temporalio/workflow";
import { bigintSort, filterNull, mapOverNull, unwrap, waitForPromises } from "~/utils.shared";

import type { createActivities } from "./activities";
import { HOST_PERSISTENT_DIR } from "./constants";

type Activites = Awaited<ReturnType<typeof createActivities>>;
const {
  checkoutAndInspect,
  getProjectsAndGitObjects,
  fetchRepository,
  getOrCreateBuildfsEvents,
  createPrebuildEvents,
} = proxyActivities<Activites>({
  startToCloseTimeout: "1 minute",
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
  const checkedOutResults = await waitForPromises(
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
          fsFilePath: `${HOST_PERSISTENT_DIR}/buildfs/${uuid4()}.ext4` as const,
        };
      });
    }),
  );
  const buildfsEvents = await getOrCreateBuildfsEvents(buildfsEventsArgs);
  const gitObjectIdsToBranches = new Map<bigint, bigint[]>();
  for (const branch of branches) {
    const branchesForGitObjectId = gitObjectIdsToBranches.get(branch.gitObjectId);
    if (branchesForGitObjectId === undefined) {
      gitObjectIdsToBranches.set(branch.gitObjectId, [branch.gitBranchId]);
    } else {
      branchesForGitObjectId.push(branch.gitBranchId);
    }
  }
  const prebuildEventsArgs = checkedOutResults.map((results, idx) => {
    return results.map((result, projectIdx) => {
      return {
        projectId: projects[projectIdx].id,
        gitObjectId: gitObjects[idx].id,
        buildfsEventId: null as bigint | null,
        fsFilePath: checkedOutPaths[idx],
        gitBranchIds: unwrap(gitObjectIdsToBranches.get(gitObjects[idx].id)),
        tasks: result === null ? [] : result.projectConfig.tasks.map((task) => task.command),
      };
    });
  });
  for (const [idx, args] of buildfsEventsArgs.entries()) {
    prebuildEventsArgs[args.gitObjectIdx][args.projectIdx].buildfsEventId =
      buildfsEvents[idx].event.id;
  }
  const prebuildEventsArgsFlat = prebuildEventsArgs.flat();
  const _prebuildEvents = await createPrebuildEvents(prebuildEventsArgsFlat);
}
