import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";

import { createActivities } from "./activities";
import { createAgentInjector } from "./agent-injector";
import { PRIVATE_SSH_KEY } from "./test-constants";

const provideActivities = (
  testFn: (args: { activities: Awaited<ReturnType<typeof createActivities>> }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAgentInjector({
    [Token.Logger]: function () {
      return new DefaultLogger("ERROR");
    } as unknown as any,
  });
  return async () => {
    try {
      await testFn({ activities: await createActivities(injector) });
    } finally {
      await injector.dispose();
    }
  };
};

test.concurrent(
  "fetchRepository, checkoutAndInspect",
  provideActivities(async ({ activities: { fetchRepository, checkoutAndInspect } }) => {
    const runId = uuidv4();
    const repositoryDrivePath = `/tmp/${runId}.ext4`;
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
    const projectConfig = await checkoutAndInspect({
      repositoryDrivePath,
      targetBranch: "main",
      outputDrivePath: `/tmp/repo-${runId}.ext4`,
    });
    expect(projectConfig).not.toBe(null);
  }),
);
