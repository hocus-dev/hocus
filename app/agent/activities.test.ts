import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import { createActivities } from "./activities";
import { createAgentInjector } from "./agent-injector";
import { PRIVATE_SSH_KEY } from "./test-constants";

const provideActivities = (
  testFn: (args: {
    activities: Awaited<ReturnType<typeof createActivities>>;
    runId: string;
  }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAgentInjector({
    [Token.Logger]: function () {
      return new DefaultLogger("ERROR");
    } as unknown as any,
  });
  const runId = uuidv4();
  return async () => {
    try {
      await testFn({ activities: await createActivities(injector), runId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Failed run id: ${runId}`);
      throw err;
    } finally {
      await injector.dispose();
    }
  };
};

test.concurrent(
  "fetchRepository, checkoutAndInspect",
  provideActivities(
    async ({ activities: { fetchRepository, checkoutAndInspect, buildfs, prebuild }, runId }) => {
      const repositoryDrivePath = `/tmp/repo-test-${runId}.ext4`;
      await fetchRepository({
        rootFsPath: "/hocus-resources/fetchrepo.ext4",
        outputDrive: {
          pathOnHost: repositoryDrivePath,
          maxSizeMiB: 100,
        },
        repository: {
          url: "git@github.com:hocus-dev/tests.git",
          credentials: {
            privateSshKey: PRIVATE_SSH_KEY,
          },
        },
      });
      const checkedOutRepositoryDrivePath = `/tmp/checkout-test-${runId}.ext4`;
      const projectConfigResult = await checkoutAndInspect({
        repositoryDrivePath,
        targetBranch: "main",
        outputDrivePath: checkedOutRepositoryDrivePath,
      });
      expect(projectConfigResult).not.toBe(null);
      const projectConfig = unwrap(projectConfigResult);
      const filesystemDrivePath = `/tmp/buildfs-test-${runId}.ext4`;
      await buildfs({
        runId,
        inputDrivePath: checkedOutRepositoryDrivePath,
        outputDrive: {
          pathOnHost: `/tmp/buildfs-test-${runId}.ext4`,
          maxSizeMiB: 2000,
        },
        dockerfilePath: projectConfig.image.file,
        contextPath: projectConfig.image.buildContext,
      });
      await prebuild({
        runId,
        projectDrivePath: checkedOutRepositoryDrivePath,
        filesystemDrivePath,
        tasks: projectConfig.tasks.map((task) => task.init),
      });
    },
  ),
);
