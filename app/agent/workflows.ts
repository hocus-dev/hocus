import path from "path";

import { proxyActivities, uuid4 } from "@temporalio/workflow";
import { bigintSort, filterNull, mapOverNull, waitForPromises } from "~/utils.shared";

import type { createActivities } from "./activities";
import { HOST_PERSISTENT_DIR } from "./constants";

type Activites = Awaited<ReturnType<typeof createActivities>>;
const { checkoutAndInspect, getProjectsAndGitObjects, fetchRepository, getOrCreateBuildfsEvents } =
  proxyActivities<Activites>({
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

  const checkedOutPaths = gitObjects.map((o) =>
    path.join(HOST_PERSISTENT_DIR, "checked-out", `${o.hash}.ext4`),
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
          fsFilePath: path.join(HOST_PERSISTENT_DIR, "buildfs", `${uuid4()}.ext4`),
        };
      });
    }),
  );
  const buildfsEvents = await getOrCreateBuildfsEvents(buildfsEventsArgs);
}
