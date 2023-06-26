import fs from "fs/promises";
import path from "path";

import { SshKeyPairType } from "@prisma/client";

import { createAgentInjector } from "../agent-injector";
import { BlockRegistryService, EXPOSE_METHOD } from "../block-registry/registry.service";
import { withExposedImage } from "../block-registry/utils";
import { PROJECT_DIR } from "../constants";
import type { HocusRuntime } from "../runtime/hocus-runtime";
import { execCmdWithOpts } from "../utils";

import type { GitRemoteInfo } from "./git.service";

import { TESTS_PRIVATE_SSH_KEY, TESTS_REPO_URL } from "~/test-utils/constants";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

jest.setTimeout(45000);

const testEnv = new TestEnvironmentBuilder(createAgentInjector).withTestLogging();

test.concurrent(
  "getRemotes",
  testEnv.run(async ({ injector }) => {
    const gitService = injector.resolve(Token.AgentGitService);
    const remotesLinux = await gitService.getRemotes(
      "git@github.com:torvalds/linux.git",
      TESTS_PRIVATE_SSH_KEY,
    );
    const linuxMaster = remotesLinux.find((r) => r.name === "refs/heads/master");
    expect(linuxMaster).toBeDefined();

    const remotes = await gitService.getRemotes(TESTS_REPO_URL, TESTS_PRIVATE_SSH_KEY);
    const expectedRemoteHash = "0d09d2f74fc2aa39c693b80e840027f7a8f8b16c";
    const expectedRemoteName = "refs/heads/git-service-test";
    const testRemote = remotes.find(
      (r) => r.name === expectedRemoteName && r.hash === expectedRemoteHash,
    );
    if (testRemote === void 0) {
      // eslint-disable-next-line no-console
      console.error(
        `Head ${expectedRemoteHash} on remote ${expectedRemoteName} not found. Received ${JSON.stringify(
          remotes,
        )}`,
      );
    }
    expect(testRemote).toBeDefined();
  }),
);

test.concurrent(
  "findRemoteUpdates",
  testEnv.run(async ({ injector }) => {
    const gitService = injector.resolve(Token.AgentGitService);
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

test.concurrent(
  "updateBranches",
  testEnv.withTestDb().run(async ({ injector, db }) => {
    const appGitService = injector.resolve(Token.GitService);
    const gitService = injector.resolve(Token.AgentGitService);
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const pair = await sshKeyService.createSshKeyPair(
      db,
      TESTS_PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    const repo = await db.$transaction((tdb) =>
      appGitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id),
    );

    const { newGitBranches, updatedGitBranches } = await gitService.updateBranches(db, repo.id);
    expect(updatedGitBranches.length).toEqual(0);
    expect(newGitBranches.length).not.toEqual(0);
    const repo2 = await db.gitRepository.findUniqueOrThrow({
      where: { id: repo.id },
    });
    expect(repo2.lastBranchUpdateAt.getTime() > repo.lastBranchUpdateAt.getTime()).toBe(true);

    const mockRemotes = newGitBranches.map((b) => ({
      name: b.name,
      hash: b.gitObject.hash,
    }));
    const mockHash = "abc";
    mockRemotes[0].hash = mockHash;
    gitService.getRemotes = jest.fn().mockResolvedValue(mockRemotes);

    const { newGitBranches: newGitBranches2, updatedGitBranches: updatedGitBranches2 } =
      await gitService.updateBranches(db, repo.id);

    expect(updatedGitBranches2.length).toEqual(1);
    expect(newGitBranches2.length).toEqual(0);
    expect(updatedGitBranches2[0].gitObject.hash).toEqual(mockHash);

    const updatedGitBranch = await db.gitBranch.findUniqueOrThrow({
      where: {
        id: updatedGitBranches2[0].id,
      },
      include: {
        gitObject: true,
      },
    });
    expect(updatedGitBranch.gitObject.hash).toEqual(mockHash);
    const allGitObjects = await db.gitObject.findMany({
      include: {
        gitObjectToBranch: true,
      },
    });
    expect(allGitObjects.map((o) => o.gitObjectToBranch.length > 0).every((b) => b)).toBe(true);
  }),
);

test.concurrent(
  "fetchRepository",
  testEnv
    .withBlockRegistry()
    .withImagePush((timestamp) => [
      {
        tag: `quay.io/hocus/hocus-tests:fetchrepo-${timestamp}`,
        imageId: BlockRegistryService.genContainerId("fetchrepo"),
      },
    ])
    .run(async ({ injector, runId, brService }) => {
      const gitService = injector.resolve(Token.AgentGitService);
      const outputId = "fetchrepo";

      const fetchRepo = (runtime: HocusRuntime) =>
        gitService.fetchRepository({
          runtime,
          outputId,
          repository: {
            credentials: { privateSshKey: TESTS_PRIVATE_SSH_KEY },
            url: TESTS_REPO_URL,
          },
          tmpContentPrefix: "test",
        });
      let ctr = 0;
      const getRuntime = () => {
        ctr += 1;
        return injector.resolve(Token.QemuService)(`${runId}-${ctr}`);
      };

      await fetchRepo(getRuntime());

      const txtFilePath = "test.txt";
      const txtFileContent = "test";
      const containerId = BlockRegistryService.genContainerId(outputId);
      await withExposedImage(
        brService,
        containerId,
        EXPOSE_METHOD.HOST_MOUNT,
        async ({ mountPoint }) => {
          const out = await execCmdWithOpts(["ls", "-lah"], {
            cwd: path.join(mountPoint, PROJECT_DIR),
          });
          expect(out.stdout).toContain(".git");
          await fs.writeFile(path.join(mountPoint, txtFilePath), txtFileContent);
        },
      );
      await fetchRepo(getRuntime());
      await withExposedImage(
        brService,
        containerId,
        EXPOSE_METHOD.HOST_MOUNT,
        async ({ mountPoint }) => {
          expect((await fs.readFile(path.join(mountPoint, txtFilePath))).toString()).toEqual(
            txtFileContent,
          );
        },
      );

      const committedImageId = await brService.commitContainer(containerId, "committed", {
        removeContainer: false,
      });
      const newContainerId = await brService.createContainer(committedImageId, "new");
      // This would fail if fetchrepo created an invalid container, for example with max size > 64 GB
      await brService.expose(newContainerId, EXPOSE_METHOD.HOST_MOUNT);
    }),
);

test.concurrent(
  "getOrCreateGitRepoImage",
  testEnv.withTestDb().run(async ({ injector, db }) => {
    const appGitService = injector.resolve(Token.GitService);
    const gitService = injector.resolve(Token.AgentGitService);
    const sshKeyService = injector.resolve(Token.SshKeyService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);

    const pair = await sshKeyService.createSshKeyPair(
      db,
      TESTS_PRIVATE_SSH_KEY,
      SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
    );
    const repo = await db.$transaction((tdb) =>
      appGitService.addGitRepository(tdb, TESTS_REPO_URL, pair.id),
    );
    const agentInstance = await db.$transaction((tdb) =>
      agentUtilService.getOrCreateSoloAgentInstance(tdb),
    );
    const images = await waitForPromises(
      Array.from({ length: 10 }).map(() =>
        db.$transaction((tdb) =>
          gitService.getOrCreateGitRepoImage(tdb, agentInstance.id, repo.id),
        ),
      ),
    );
    expect(images.every((f) => f.id === images[0].id)).toBe(true);
  }),
);
