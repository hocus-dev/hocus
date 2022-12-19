import { DefaultLogger } from "@temporalio/worker";
import { Token } from "~/token";

import { createAgentInjector } from "../agent-injector";
import { PRIVATE_SSH_KEY, TESTS_REPO_URL } from "../test-constants";

import type { GitRemoteInfo } from "./git.service";

const provideInjector = (
  testFn: (args: { injector: ReturnType<typeof createAgentInjector> }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAgentInjector({
    [Token.Logger]: function () {
      return new DefaultLogger("ERROR");
    } as unknown as any,
  });
  return async () => await testFn({ injector });
};

test.concurrent(
  "getRemotes",
  provideInjector(async ({ injector }) => {
    const gitService = injector.resolve(Token.GitService);
    const remotesLinux = await gitService.getRemotes(
      "git@github.com:torvalds/linux.git",
      PRIVATE_SSH_KEY,
    );
    const linuxMaster = remotesLinux.find((r) => r.name === "refs/heads/master");
    expect(linuxMaster).toBeDefined();

    const remotes = await gitService.getRemotes(TESTS_REPO_URL, PRIVATE_SSH_KEY);
    const testRemote = remotes.find(
      (r) =>
        r.name === "refs/heads/git-service-test" &&
        r.hash === "6aa1af1afb061b67d22e6bcd8a1d8d5bbec64987",
    );
    expect(testRemote).toBeDefined();
  }),
);

test.concurrent(
  "findRemoteUpdates",
  provideInjector(async ({ injector }) => {
    const gitService = injector.resolve(Token.GitService);
    const remotes = [
      {
        name: "remote0",
        hash: "0",
      },
      {
        name: "remote1",
        hash: "1",
      },
      {
        name: "remote2",
        hash: "2",
      },
      {
        name: "remote3",
        hash: "3",
      },
    ];
    const oldRemotes: GitRemoteInfo[] = [0, 1, 3].map((i) => ({ ...remotes[i] }));
    const newRemotes: GitRemoteInfo[] = [1, 2, 3].map((i) => ({ ...remotes[i] }));
    newRemotes[0].hash = "1.1";
    const result = await gitService.findRemoteUpdates(oldRemotes, newRemotes);
    const expectedResult: typeof result = [
      {
        remoteInfo: remotes[0],
        state: "deleted",
      },
      {
        remoteInfo: newRemotes[0],
        state: "updated",
      },
      {
        remoteInfo: remotes[2],
        state: "new",
      },
    ];
    result.sort((a, b) => a.remoteInfo.name.localeCompare(b.remoteInfo.name));
    expect(result).toMatchObject(expectedResult);
  }),
);
