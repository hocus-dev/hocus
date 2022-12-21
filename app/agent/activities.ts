import fsSync from "fs";
import fs from "fs/promises";
import { promisify } from "util";

import type { GitObject, PrebuildEvent, Prisma, Project } from "@prisma/client";
import { VmTaskStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

import type { createAgentInjector } from "./agent-injector";
import type { VMTaskOutput } from "./agent-util.types";
import { PidValidator } from "./pid.validator";
import type { ProjectConfig } from "./project-config/validator";
import { execSshCmd, randomString } from "./utils";

export const createActivities = async (
  injector: ReturnType<typeof createAgentInjector>,
  db: Prisma.NonTransactionClient,
) => {
  const agentConfig = injector.resolve(Token.Config).agent();

  const fetchRepository = async (args: {
    /**
     * Every project should have a separate root fs,
     * because repository credentials are stored in the root fs.
     */
    rootFsPath: string;
    outputDrive: {
      pathOnHost: string;
      maxSizeMiB: number;
    };
    repository: {
      url: string;
      credentials?: {
        /**
         * The contents of the private SSH key, e.g.:
         * ```
         * -----BEGIN OPENSSH PRIVATE KEY-----
         * b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
         * ...
         * -----END OPENSSH PRIVATE KEY-----
         * ```
         * Keep in mind that a newline at the end of the key is required.
         */
        privateSshKey: string;
      };
    };
  }): Promise<void> => {
    const instanceId = `fetchrepo-${uuidv4()}`;
    const logger = injector.resolve(Token.Logger);
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const outputDriveExists = fsSync.existsSync(args.outputDrive.pathOnHost);
    if (!outputDriveExists) {
      agentUtilService.createExt4Image(args.outputDrive.pathOnHost, args.outputDrive.maxSizeMiB);
      logger.info(`empty output image created at ${args.outputDrive.pathOnHost}`);
    }
    const outputDir = "/tmp/output";
    await firecrackerService.withVM(
      {
        ssh: {
          username: "hocus",
          password: "hocus",
        },
        kernelPath: agentConfig.defaultKernel,
        rootFsPath: args.rootFsPath,
        extraDrives: [
          {
            pathOnHost: args.outputDrive.pathOnHost,
            guestMountPath: outputDir,
          },
        ],
      },
      async ({ ssh }) => {
        const repositoryDir = `${outputDir}/project`;
        const logFilePath = "/tmp/ssh-fetchrepo.log";
        if (!outputDriveExists) {
          await execSshCmd({ ssh }, ["sudo", "chown", "-R", "hocus:hocus", outputDir]);
        }

        const sshKey = args.repository.credentials?.privateSshKey;
        const sshDir = "/home/hocus/.ssh";
        if (sshKey != null) {
          // The name is misleading, since the user may not be
          // using RSA, but git automatically looks for this file and
          // it will work no matter the actual ssh key format.
          const sshKeyPath = `${sshDir}/id_rsa`;
          await execSshCmd({ ssh }, ["mkdir", "-p", sshDir]);
          await execSshCmd({ ssh }, ["sudo", "mount", "-t", "tmpfs", "ssh", sshDir]);
          await execSshCmd({ ssh }, ["sudo", "chown", "hocus:hocus", sshDir]);
          await execSshCmd({ ssh }, ["chmod", "700", sshDir]);
          await ssh.withSFTP(async (sftp) => {
            const writeFile = promisify(sftp.writeFile.bind(sftp));
            await writeFile(sshKeyPath, sshKey);
          });
          await execSshCmd({ ssh }, ["chmod", "400", sshKeyPath]);
        }

        const repositoryExists =
          (
            await execSshCmd({ ssh, allowNonZeroExitCode: true }, [
              "test",
              "-d",
              `${repositoryDir}/.git`,
            ])
          ).code === 0;
        if (repositoryExists) {
          await execSshCmd({ ssh, logFilePath, opts: { cwd: repositoryDir } }, [
            "git",
            "fetch",
            "--all",
          ]);
        } else {
          await execSshCmd(
            {
              ssh,
              logFilePath,
              opts: {
                execOptions: {
                  env: {
                    // Without this, git will ask for user input and the command will fail.
                    // This is obviously not secure, the correct method would be to
                    // TODO: allow the user to specify a known_hosts file.
                    GIT_SSH_COMMAND:
                      "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no",
                  } as any,
                },
              },
            },
            ["git", "clone", "--no-checkout", args.repository.url, repositoryDir],
          );
        }
      },
    );
  };

  const buildfs = async (args: {
    /**
     * Used to construct file paths. Autogenerated if not specified.
     * Useful mostly for debugging.
     */
    runId?: string;
    /**
     * Path to a drive with a Dockerfile.
     */
    inputDrivePath: string;
    outputDrive: {
      pathOnHost: string;
      maxSizeMiB: number;
    };
    buildfsEventId: bigint;
    db: Prisma.NonTransactionClient;
  }): Promise<{ buildSuccessful: boolean }> => {
    const runId = args.runId ?? uuidv4();
    const instanceId = `buildfs-${runId}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const buildfsService = injector.resolve(Token.BuildfsService);

    agentUtilService.createExt4Image(
      args.outputDrive.pathOnHost,
      args.outputDrive.maxSizeMiB,
      true,
    );

    const buildfsEvent = await db.buildfsEvent.findUniqueOrThrow({
      where: { id: args.buildfsEventId },
    });

    const result = await firecrackerService.withVM(
      {
        ssh: {
          username: "root",
          password: "root",
        },
        kernelPath: agentConfig.defaultKernel,
        rootFsPath: agentConfig.buildfsRootFs,
        extraDrives: [
          { pathOnHost: args.outputDrive.pathOnHost, guestMountPath: buildfsService.outputDir },
          { pathOnHost: args.inputDrivePath, guestMountPath: buildfsService.inputDir },
        ],
      },
      async ({ ssh, sshConfig }) => {
        const workdir = "/tmp/workdir";
        const buildfsScriptPath = `${workdir}/bin/buildfs.sh`;
        await execSshCmd({ ssh }, ["rm", "-rf", workdir]);
        await execSshCmd({ ssh }, ["mkdir", "-p", workdir]);
        await ssh.putDirectory(agentConfig.hostBuildfsResourcesDir, workdir);
        await execSshCmd({ ssh }, ["chmod", "+x", buildfsScriptPath]);

        const taskResults = await agentUtilService.execVmTasks(sshConfig, db, [
          { vmTaskId: buildfsEvent.vmTaskId },
        ]);
        return taskResults[0];
      },
    );

    return { buildSuccessful: result.status === VmTaskStatus.VM_TASK_STATUS_SUCCESS };
  };

  /**
   * Copies the contents of `repositoryDrivePath` into `outputDrivePath`, and checks
   * out the given branch there.
   *
   * Returns an array of `ProjectConfig`s or `null`s corresponding to the
   * `projectConfigPaths` argument. If a hocus config file is not present in a directory,
   * `null` is returned.
   */
  const checkoutAndInspect = async (args: {
    /**
     * Should point to the output of `fetchRepository`
     */
    repositoryDrivePath: string;
    /**
     * The repository will be checked out to this branch.
     */
    targetBranch: string;
    /**
     * A new drive will be created at this path.
     */
    outputDrivePath: string;
    /**
     * Relative paths to directories where `hocus.yml` files are located.
     */
    projectConfigPaths: string[];
  }): Promise<(ProjectConfig | null)[]> => {
    const instanceId = `checkout-and-inspect-${randomString(8)}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const logger = injector.resolve(Token.Logger);
    const projectConfigService = injector.resolve(Token.ProjectConfigService);
    if (fsSync.existsSync(args.outputDrivePath)) {
      logger.warn(
        `output drive already exists at "${args.outputDrivePath}", it will be overwritten`,
      );
    }
    await fs.copyFile(args.repositoryDrivePath, args.outputDrivePath);
    const workdir = "/tmp/workdir";
    try {
      return await firecrackerService.withVM(
        {
          ssh: {
            username: "hocus",
            password: "hocus",
          },
          kernelPath: agentConfig.defaultKernel,
          rootFsPath: agentConfig.checkoutAndInspectRootFs,
          extraDrives: [{ pathOnHost: args.outputDrivePath, guestMountPath: workdir }],
        },
        async ({ ssh }) => {
          const repoPath = `${workdir}/project`;

          await execSshCmd({ ssh, opts: { cwd: repoPath } }, [
            "git",
            "checkout",
            args.targetBranch,
          ]);
          return await waitForPromises(
            args.projectConfigPaths.map((p) => projectConfigService.getConfig(ssh, repoPath, p)),
          );
        },
      );
    } catch (err) {
      await fs.unlink(args.outputDrivePath);
      throw err;
    }
  };

  /**
   * Returns the result for every task.
   *
   * Assumes that there is a `hocus` user with passwordless sudo on the
   * filesystem drive, sshd is configured to start running automatically after VM boot,
   * and the corresponding public key to the private key used to connect to the VM
   * (`agentConfig.prebuildSshPrivateKey`) is already present in the `hocus` user's authorized_keys.
   */
  const prebuild = async (args: {
    runId?: string;
    projectDrivePath: string;
    filesystemDrivePath: string;
    env?: { [key: string]: string };
    prebuildEventId: bigint;
  }): Promise<VMTaskOutput[]> => {
    const runId = args.runId ?? uuidv4();
    const instanceId = `prebuild-${runId}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const prebuildService = injector.resolve(Token.PrebuildService);

    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: args.prebuildEventId },
      include: { tasks: { include: { vmTask: true } } },
    });
    const tasks = prebuildEvent.tasks;
    return await firecrackerService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: agentConfig.defaultKernel,
        rootFsPath: args.filesystemDrivePath,
        extraDrives: [
          { pathOnHost: args.projectDrivePath, guestMountPath: prebuildService.devDir },
        ],
      },
      async ({ ssh, sshConfig }) => {
        await Promise.all(
          tasks.map(async (task) => {
            const script = agentUtilService.generateTaskScript(task.originalCommand);
            const paths = prebuildService.getPrebuildTaskPaths(task.idx);
            await execSshCmd({ ssh }, ["mkdir", "-p", prebuildService.prebuildScriptsDir]);
            await agentUtilService.writeFile(ssh, paths.scriptPath, script);
          }),
        );

        return await agentUtilService.execVmTasks(
          sshConfig,
          db,
          tasks.map((t) => ({ vmTaskId: t.vmTask.id, env: args.env })),
        );
      },
    );
  };

  type StartWorkspaceReturnValue = {
    firecrackerProcessPid: number;
    vmIp: string;
    vmInstanceId: string;
    ipBlockId: number;
    taskPids: number[];
  };

  const startWorkspace = async (args: {
    runId?: string;
    filesystemDrivePath: string;
    projectDrivePath: string;
    authorizedKeys: string[];
    tasks: string[];
  }): Promise<StartWorkspaceReturnValue> => {
    const runId = args.runId ?? uuidv4();
    const instanceId = `startvm-${runId}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const sshGatewayService = injector.resolve(Token.SSHGatewayService);
    const devDir = "/home/hocus/dev";
    const repositoryDir = `${devDir}/project`;
    const scriptsDir = `${devDir}/.hocus/command`;

    return await firecrackerService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: agentConfig.defaultKernel,
        rootFsPath: args.filesystemDrivePath,
        extraDrives: [{ pathOnHost: args.projectDrivePath, guestMountPath: devDir }],
        shouldPoweroff: false,
      },
      async ({ ssh, vmIp, firecrackerPid, ipBlockId }) => {
        const taskFn = async (task: string, taskIdx: number): Promise<number> => {
          const script = agentUtilService.generateTaskScript(task);
          const scriptPath = `${scriptsDir}/task-${taskIdx}.sh`;
          const logPath = `${scriptsDir}/task-${taskIdx}.log`;
          await execSshCmd({ ssh }, ["mkdir", "-p", scriptsDir]);
          await agentUtilService.writeFile(ssh, scriptPath, script);

          const result = await execSshCmd({ ssh, opts: { cwd: repositoryDir } }, [
            "bash",
            "-o",
            "pipefail",
            "-o",
            "errexit",
            "-c",
            `bash "${scriptPath}" > "${logPath}" 2>&1 & echo "$!"`,
          ]);
          return Number(PidValidator.Parse(result.stdout));
        };
        const authorizedKeys = args.authorizedKeys.map((key) => key.trim());
        await agentUtilService.writeFile(
          ssh,
          "/home/hocus/.ssh/authorized_keys",
          authorizedKeys.join("\n") + "\n",
        );
        const taskPids = await Promise.all(args.tasks.map(taskFn));
        await firecrackerService.changeVMNetworkVisibility(ipBlockId, "public");
        await sshGatewayService.addPublicKeysToAuthorizedKeys(authorizedKeys);
        return {
          firecrackerProcessPid: firecrackerPid,
          vmIp,
          taskPids,
          ipBlockId,
          vmInstanceId: instanceId,
        };
      },
    );
  };

  const stopWorkspace = async (args: { instanceId: string; ipBlockId: number }): Promise<void> => {
    const firecrackerService = injector.resolve(Token.FirecrackerService)(args.instanceId);
    await firecrackerService.shutdownVMAndReleaseResources(args.ipBlockId);
  };

  const preparePrebuild = async (args: {
    projectId: bigint;
    gitObjectId: bigint;
    prebuildTasks: string[];
  }): Promise<
    PrebuildEvent & {
      gitObject: GitObject;
      project: Project;
    }
  > => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const prebuildEvent = await db.$transaction(async (tdb) =>
      prebuildService.preparePrebuild(tdb, args.projectId, args.gitObjectId, args.prebuildTasks),
    );
    return await db.prebuildEvent.findUniqueOrThrow({
      where: { id: prebuildEvent.id },
      include: { gitObject: true, project: true },
    });
  };

  return {
    fetchRepository,
    buildfs,
    checkoutAndInspect,
    prebuild,
    startWorkspace,
    stopWorkspace,
    preparePrebuild,
  };
};
