import type {
  GitObject,
  PrebuildEvent,
  PrebuildEventFiles,
  Prisma,
  Project,
  Workspace,
  WorkspaceInstance,
} from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import type { Any } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";
import { unwrap, waitForPromises } from "~/utils.shared";

import type { createAgentInjector } from "./agent-injector";
import type { VMTaskOutput } from "./agent-util.types";
import type { BuildfsService } from "./buildfs.service";
import { SOLO_AGENT_INSTANCE_ID } from "./constants";
import type { PrebuildService } from "./prebuild.service";
import { execSshCmd, randomString } from "./utils";

export const createActivities = async (
  injector: ReturnType<typeof createAgentInjector>,
  db: Prisma.NonTransactionClient,
) => {
  const agentConfig = injector.resolve(Token.Config).agent();

  const fetchRepository = async (gitRepositoryId: bigint): Promise<void> => {
    const instanceId = `fetchrepo-${uuidv4()}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const gitService = injector.resolve(Token.GitService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const repo = await db.gitRepository.findUniqueOrThrow({
      where: { id: gitRepositoryId },
      include: {
        sshKeyPair: true,
      },
    });
    const repoFile = await db.$transaction(async (tdb) => {
      const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);
      return await gitService.getOrCreateGitRepositoryFile(tdb, agentInstance.id, repo.id);
    });
    await gitService.fetchRepository(
      firecrackerService,
      {
        pathOnHost: repoFile.file.path,
        maxSizeMiB: 5000,
      },
      {
        url: repo.url,
        credentials: {
          privateSshKey: repo.sshKeyPair.privateKey,
        },
      },
    );
  };

  const buildfs = async (args: {
    buildfsEventId: bigint;
    outputDriveMaxSizeMiB: number;
  }): Promise<{ buildSuccessful: boolean }> => {
    const instanceId = `buildfs-${uuidv4()}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const buildfsService = injector.resolve(Token.BuildfsService);

    return await buildfsService.buildfs({ ...args, db, firecrackerService });
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
    gitRepositoryId: bigint;
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
  }): Promise<Awaited<ReturnType<PrebuildService["checkoutAndInspect"]>>> => {
    const instanceId = `checkout-and-inspect-${randomString(8)}`;
    const fcService = injector.resolve(Token.FirecrackerService)(instanceId);
    const prebuildService = injector.resolve(Token.PrebuildService);
    const gitRepository = await db.gitRepository.findUniqueOrThrow({
      where: { id: args.gitRepositoryId },
      include: {
        gitRepositoryFiles: { include: { agentInstance: true, file: true } },
      },
    });
    const repoFile = unwrap(
      gitRepository.gitRepositoryFiles.find(
        (f) => f.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    );
    return await prebuildService.checkoutAndInspect({
      fcService,
      repositoryDrivePath: repoFile.file.path,
      targetBranch: args.targetBranch,
      outputDrivePath: args.outputDrivePath,
      projectConfigPaths: args.projectConfigPaths,
    });
  };

  /**
   * Returns the result for every task.
   *
   * Assumes that there is a `hocus` user with passwordless sudo on the
   * filesystem drive, sshd is configured to start running automatically after VM boot,
   * and the corresponding public key to the private key used to connect to the VM
   * (`agentConfig.prebuildSshPrivateKey`) is already present in the `hocus` user's authorized_keys.
   */
  const prebuild = async (args: { prebuildEventId: bigint }): Promise<VMTaskOutput[]> => {
    const runId = uuidv4();
    const instanceId = `prebuild-${runId}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const prebuildService = injector.resolve(Token.PrebuildService);

    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: args.prebuildEventId },
      include: {
        tasks: { include: { vmTask: true } },
        prebuildEventFiles: { include: { agentInstance: true, fsFile: true, projectFile: true } },
        project: {
          include: {
            environmentVariableSet: {
              include: {
                environmentVariables: true,
              },
            },
          },
        },
      },
    });
    const prebuildEventFiles = unwrap(
      prebuildEvent.prebuildEventFiles.find(
        (f) => f.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    );
    const envVariablesLength =
      prebuildEvent.project.environmentVariableSet.environmentVariables.length;
    const envVariables = Object.fromEntries(
      prebuildEvent.project.environmentVariableSet.environmentVariables.map((v) => [
        v.name,
        v.value,
      ]),
    );
    const tasks = prebuildEvent.tasks;
    return await firecrackerService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: agentConfig.defaultKernel,
        rootFsPath: prebuildEventFiles.fsFile.path,
        extraDrives: [
          {
            pathOnHost: prebuildEventFiles.projectFile.path,
            guestMountPath: prebuildService.devDir,
          },
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
          tasks.map((t) => ({
            vmTaskId: t.vmTask.id,
            env: envVariablesLength > 0 ? envVariables : void 0,
          })),
        );
      },
    );
  };

  const createWorkspace = async (args: {
    name: string;
    prebuildEventId: bigint;
    gitBranchId: bigint;
    userId: bigint;
    externalId: string;
  }): Promise<Workspace> => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);

    const workspace = await db.$transaction(async (tdb): Promise<Workspace> => {
      const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);

      return await workspaceAgentService.createWorkspaceInDb(tdb, {
        externalId: args.externalId,
        gitBranchId: args.gitBranchId,
        name: args.name,
        prebuildEventId: args.prebuildEventId,
        userId: args.userId,
        agentInstanceId: agentInstance.id,
      });
    });

    await workspaceAgentService.createWorkspaceFiles(db, workspace.id);

    return workspace;
  };

  const startWorkspace = async (workspaceId: bigint): Promise<WorkspaceInstance> => {
    const monitoringWorkflowId = uuidv4();
    const fcInstanceId = monitoringWorkflowId;

    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);

    await db.$transaction((tdb) =>
      workspaceAgentService.markWorkspaceAs(
        tdb,
        workspaceId,
        WorkspaceStatus.WORKSPACE_STATUS_PENDING_START,
      ),
    );
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        rootFsFile: true,
        projectFile: true,
        prebuildEvent: true,
        user: {
          include: {
            sshPublicKeys: true,
          },
        },
      },
    });
    const instanceInfo = await workspaceAgentService.startWorkspace({
      fcInstanceId,
      filesystemDrivePath: workspace.rootFsFile.path,
      projectDrivePath: workspace.projectFile.path,
      authorizedKeys: workspace.user.sshPublicKeys.map((k) => k.publicKey),
      tasks: workspace.prebuildEvent.workspaceTasks,
    });
    return await db.$transaction((tdb) =>
      workspaceAgentService.createWorkspaceInstanceInDb(tdb, {
        workspaceId,
        firecrackerInstanceId: fcInstanceId,
        monitoringWorkflowId,
        vmIp: instanceInfo.vmIp,
      }),
    );
  };

  const stopWorkspace = async (workspaceId: bigint): Promise<void> => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);

    await db.$transaction((tdb) =>
      workspaceAgentService.markWorkspaceAs(
        tdb,
        workspaceId,
        WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP,
      ),
    );
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        activeInstance: true,
      },
    });
    const instance = unwrap(workspace.activeInstance);
    const firecrackerService = injector.resolve(Token.FirecrackerService)(
      instance.firecrackerInstanceId,
    );

    const vmInfo = await firecrackerService.getVMInfo();
    if (vmInfo?.status === "on") {
      await firecrackerService.shutdownVM();
    }
    if (vmInfo != null) {
      await firecrackerService.releaseVmResources(vmInfo.info.ipBlockId);
    }
    await firecrackerService.tryDeleteVmDir();

    await db.$transaction((tdb) =>
      workspaceAgentService.removeWorkspaceInstanceFromDb(tdb, workspaceId),
    );
  };

  const getProjectsAndGitObjects = async (
    gitRepositoryId: bigint,
    gitObjectIds: bigint[],
  ): Promise<{ projects: Project[]; gitObjects: GitObject[] }> => {
    const projects = await db.project.findMany({
      where: { gitRepositoryId: gitRepositoryId },
    });
    const gitObjects = await db.gitObject.findMany({
      where: { id: { in: gitObjectIds } },
    });
    if (gitObjects.length !== gitObjectIds.length) {
      throw new Error("Some git objects were not found");
    }
    return { projects, gitObjects };
  };

  type GetOrCreateBuildfsEventsReturnType = Any.Compute<
    Awaited<ReturnType<BuildfsService["getOrCreateBuildfsEvent"]>>
  >[];
  const getOrCreateBuildfsEvents = async (
    args: {
      contextPath: string;
      dockerfilePath: string;
      cacheHash: string | null;
      outputFilePath: string;
      projectFilePath: string;
      projectId: bigint;
    }[],
  ): Promise<GetOrCreateBuildfsEventsReturnType> => {
    const buildfsService = injector.resolve(Token.BuildfsService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const agentInstance = await db.$transaction((tdb) =>
      agentUtilService.getOrCreateSoloAgentInstance(tdb),
    );
    return await db.$transaction((tdb) =>
      waitForPromises(
        args.map((arg) =>
          buildfsService.getOrCreateBuildfsEvent(tdb, {
            ...arg,
            cacheHash: arg.cacheHash ?? `CACHE_HASH_NULL_${uuidv4()}`,
            agentInstanceId: agentInstance.id,
          }),
        ),
      ),
    );
  };

  const createPrebuildEvents = async (
    args: {
      projectId: bigint;
      gitObjectId: bigint;
      gitBranchIds: bigint[];
      buildfsEventId: bigint | null;
      sourceProjectDrivePath: string;
      tasks: { command: string; cwd: string }[];
      workspaceTasks: string[];
    }[],
  ): Promise<PrebuildEvent[]> => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);

    return await db.$transaction(async (tdb) => {
      const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);
      return await waitForPromises(
        args.map((arg) =>
          prebuildService.preparePrebuild(tdb, { ...arg, agentInstanceId: agentInstance.id }),
        ),
      );
    });
  };

  const createPrebuildFiles = async (args: {
    prebuildEventId: bigint;
    sourceProjectDrivePath: string;
  }): Promise<PrebuildEventFiles> => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);

    const agentInstance = await db.$transaction(async (tdb) =>
      agentUtilService.getOrCreateSoloAgentInstance(tdb),
    );
    return await prebuildService.createPrebuildEventFiles(db, {
      ...args,
      agentInstanceId: agentInstance.id,
    });
  };

  return {
    fetchRepository,
    buildfs,
    checkoutAndInspect,
    prebuild,
    startWorkspace,
    stopWorkspace,
    getProjectsAndGitObjects,
    getOrCreateBuildfsEvents,
    createPrebuildEvents,
    createPrebuildFiles,
    createWorkspace,
  };
};
