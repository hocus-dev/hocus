import fs from "fs/promises";
import path from "path";

import { DefaultLogger } from "@temporalio/worker";
import { FetchError, ResponseError } from "firecracker-client";
import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import { createActivities } from "./activities";
import { createAgentInjector } from "./agent-injector";
import { PrebuildTaskStatus } from "./constants";
import { PRIVATE_SSH_KEY, PUBLIC_SSH_KEY, SSH_PROXY_IP } from "./test-constants";
import { execCmd, execSshCmd, withSsh } from "./utils";

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
      /* eslint-disable no-console */
      console.error(`Failed run id: ${runId}`);
      if (err instanceof ResponseError) {
        console.error(
          `Status: ${err.response.status} ${err.response.statusText}\n${await err.response.text()}`,
        );
      } else if (err instanceof FetchError) {
        console.error(err.cause);
      } else {
        console.error(err);
      }
      /* eslint-enable no-console */
      throw err;
    } finally {
      await injector.dispose();
    }
  };
};

test.concurrent(
  "fetchRepository, checkoutAndInspect, prebuild, startWorkspace",
  provideActivities(
    async ({
      activities: { fetchRepository, checkoutAndInspect, buildfs, prebuild, startWorkspace },
      runId,
    }) => {
      const tmpPath = "/srv/jailer/resources/tmp/";
      execCmd("mkdir", "-p", tmpPath);
      const repositoryDrivePath = path.join(tmpPath, `repo-test-${runId}.ext4`);
      await fetchRepository({
        rootFsPath: "/srv/jailer/resources/fetchrepo.ext4",
        outputDrive: {
          pathOnHost: repositoryDrivePath,
          maxSizeMiB: 10000,
        },
        repository: {
          url: "git@github.com:hocus-dev/tests.git",
          credentials: {
            privateSshKey: PRIVATE_SSH_KEY,
          },
        },
      });
      const checkedOutRepositoryDrivePath = path.join(tmpPath, `checkout-test-${runId}.ext4`);
      const projectConfigResult = await checkoutAndInspect({
        repositoryDrivePath,
        targetBranch: "main",
        outputDrivePath: checkedOutRepositoryDrivePath,
      });
      expect(projectConfigResult).not.toBe(null);
      const projectConfig = unwrap(projectConfigResult);
      const filesystemDrivePath = path.join(tmpPath, `buildfs-test-${runId}.ext4`);
      await buildfs({
        runId,
        inputDrivePath: checkedOutRepositoryDrivePath,
        outputDrive: {
          pathOnHost: path.join(tmpPath, `buildfs-test-${runId}.ext4`),
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

      // here we check that when a task fails, other tasks are interrupted
      // and the prebuild is aborted
      const results = await prebuild({
        runId: runId + `-2`,
        projectDrivePath: checkedOutRepositoryDrivePath,
        filesystemDrivePath,
        tasks: [
          `echo "alright!"`,
          "sleep 15",
          "sleep 15",
          `sleep 1 && test -z "this task will fail"`,
        ],
      });
      expect(results[0].status).toEqual(PrebuildTaskStatus.Ok);
      for (const idx of [1, 2]) {
        expect(results[idx].status).toEqual(PrebuildTaskStatus.Cancelled);
      }
      expect(results[3].status).toEqual(PrebuildTaskStatus.Error);

      let fcPid: number | null = null;
      const pathToKey = "/tmp/testkey";
      try {
        const secondTaskOutput = "hello world from the second command!";
        const secondTask = `echo -n '${secondTaskOutput}'`;
        const workspaceStartResult = await startWorkspace({
          runId,
          projectDrivePath: checkedOutRepositoryDrivePath,
          filesystemDrivePath,
          tasks: [`test -z "this task will fail"`, secondTask],
          authorizedKeys: [PUBLIC_SSH_KEY],
        });
        fcPid = workspaceStartResult.firecrackerProcessPid;
        await withSsh(
          {
            username: "hocus",
            privateKey: PRIVATE_SSH_KEY,
            host: workspaceStartResult.vmIp,
          },
          async (ssh) => {
            const { stdout } = await execSshCmd({ ssh }, [
              "cat",
              "/home/hocus/dev/.hocus/command/task-1.log",
            ]);
            expect(stdout).toEqual(`+ ${secondTask}\n${secondTaskOutput}`);
          },
        );
        await fs.writeFile(pathToKey, PRIVATE_SSH_KEY);
        execCmd("chmod", "600", pathToKey);
        const echoOutput = "I was executed via ssh";
        const proxySshCmdOutput = execCmd(
          "ip",
          "netns",
          "exec",
          "tst",
          "ssh",
          "-o",
          `ProxyCommand=ssh -W %h:%p -i ${pathToKey} sshgateway@${SSH_PROXY_IP}`,
          "-o",
          "StrictHostKeyChecking=no",
          "-i",
          pathToKey,
          `hocus@${workspaceStartResult.vmIp}`,
          "echo",
          "-n",
          echoOutput,
        );
        expect(proxySshCmdOutput.output.toString().includes(echoOutput)).toBe(true);
      } finally {
        await fs.rm(pathToKey, { force: true });
        if (fcPid != null) {
          process.kill(fcPid);
        }
      }
    },
  ),
);
