import path from "path";

import type {
  GitBranch,
  GitObject,
  GitRepository,
  PrebuildEvent,
  PrebuildEventFiles,
  PrebuildEventStatus,
  Prisma,
  Project,
  Workspace,
  WorkspaceInstance,
} from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";
import { unwrap, waitForPromises } from "~/utils.shared";

import type { CheckoutAndInspectResult } from "./activities-types";
import type { createAgentInjector } from "./agent-injector";
import type { VMTaskOutput } from "./agent-util.types";
import type { GetOrCreateBuildfsEventsReturnType } from "./buildfs.service";
import { SOLO_AGENT_INSTANCE_ID, WORKSPACE_ENV_SCRIPT_PATH } from "./constants";
import type { UpdateBranchesResult } from "./git/git.service";
import { execSshCmd, randomString } from "./utils";

interface Activities {
  fetchRepository: (gitRepositoryId: bigint) => Promise<void>;
  buildfs: (args: {
    buildfsEventId: bigint;
    outputDriveMaxSizeMiB: number;
  }) => Promise<{ buildSuccessful: boolean }>;
  checkoutAndInspect: (args: {
    gitRepositoryId: bigint;
    targetBranch: string;
    outputDrivePath: string;
    projectConfigPaths: string[];
  }) => Promise<CheckoutAndInspectResult[]>;
  prebuild: (args: { prebuildEventId: bigint }) => Promise<VMTaskOutput[]>;
  cancelPrebuilds: (prebuildEventIds: bigint[]) => Promise<void>;
  changePrebuildEventStatus: (
    prebuildEventId: bigint,
    status: PrebuildEventStatus,
  ) => Promise<void>;
  createWorkspace: (args: {
    name: string;
    prebuildEventId: bigint;
    gitBranchId: bigint;
    userId: bigint;
    externalId: string;
  }) => Promise<Workspace>;
  startWorkspace: (workspaceId: bigint) => Promise<WorkspaceInstance>;
  stopWorkspace: (workspaceId: bigint) => Promise<void>;
  getProjectsAndGitObjects: (
    projectIds: bigint[],
    gitObjectIds: bigint[],
  ) => Promise<{ projects: Project[]; gitObjects: GitObject[] }>;
  getOrCreateBuildfsEvents: (
    args: {
      contextPath: string;
      dockerfilePath: string;
      cacheHash: string | null;
      outputFilePath: string;
      projectFilePath: string;
      projectId: bigint;
    }[],
  ) => Promise<GetOrCreateBuildfsEventsReturnType[]>;
  createPrebuildEvents: (
    args: {
      projectId: bigint;
      gitObjectId: bigint;
      gitBranchIds: bigint[];
      buildfsEventId: bigint | null;
      sourceProjectDrivePath: string;
      tasks: { command: string; cwd: string }[];
      workspaceTasks: string[];
    }[],
  ) => Promise<PrebuildEvent[]>;
  createPrebuildFiles: (args: {
    prebuildEventId: bigint;
    sourceProjectDrivePath: string;
  }) => Promise<PrebuildEventFiles>;
  getWorkspaceInstanceStatus: (
    workspaceInstanceId: bigint,
  ) => Promise<"on" | "off" | "paused" | "removed">;
  addProjectAndRepository: (args: {
    gitRepositoryUrl: string;
    projectName: string;
    projectWorkspaceRoot: string;
  }) => Promise<{
    project: Project;
    gitRepository: GitRepository;
    gitRepositoryCreated: boolean;
  }>;
  getRepositoryProjects: (gitRepositoryId: bigint) => Promise<Project[]>;
  updateGitBranchesAndObjects: (gitRepositoryId: bigint) => Promise<UpdateBranchesResult>;
  getDefaultBranch: (gitRepositoryId: bigint) => Promise<GitBranch | null>;
}
interface Args {
  injector: ReturnType<typeof createAgentInjector>;
  db: Prisma.NonTransactionClient;
}

type ActivitiesCreateFns = {
  [K in keyof Activities]: (args: Args) => Activities[K];
};

const fetchRepository: ActivitiesCreateFns["fetchRepository"] =
  ({ injector, db }: Args) =>
  async (gitRepositoryId: bigint) => {
    const instanceId = `fetchrepo-${uuidv4()}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const gitService = injector.resolve(Token.AgentGitService);
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

const buildfs: ActivitiesCreateFns["buildfs"] =
  ({ injector, db }: Args) =>
  async (args: {
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
const checkoutAndInspect: ActivitiesCreateFns["checkoutAndInspect"] =
  ({ injector, db }: Args) =>
  async (args: {
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
  }): Promise<CheckoutAndInspectResult[]> => {
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
const prebuild: ActivitiesCreateFns["prebuild"] =
  ({ injector, db }: Args) =>
  async (args: { prebuildEventId: bigint }): Promise<VMTaskOutput[]> => {
    const runId = uuidv4();
    const instanceId = `prebuild-${runId}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const prebuildService = injector.resolve(Token.PrebuildService);
    const agentConfig = injector.resolve(Token.Config).agent();

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
    const envVariables = prebuildEvent.project.environmentVariableSet.environmentVariables.map(
      (v) => ({
        name: v.name,
        value: v.value,
      }),
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
        const envScript = agentUtilService.generateEnvVarsScript(envVariables);
        await execSshCmd({ ssh }, ["mkdir", "-p", path.dirname(WORKSPACE_ENV_SCRIPT_PATH)]);
        await agentUtilService.writeFile(ssh, WORKSPACE_ENV_SCRIPT_PATH, envScript);
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
          })),
        );
      },
    );
  };

const cancelPrebuilds: ActivitiesCreateFns["cancelPrebuilds"] =
  ({ injector, db }: Args) =>
  async (prebuildEventIds: bigint[]): Promise<void> => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    await db.$transaction((tdb) => prebuildService.cancelPrebuilds(tdb, prebuildEventIds));
  };

const changePrebuildEventStatus: ActivitiesCreateFns["changePrebuildEventStatus"] =
  ({ injector, db }: Args) =>
  async (prebuildEventId: bigint, status: PrebuildEventStatus): Promise<void> => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    await db.$transaction((tdb) =>
      prebuildService.changePrebuildEventStatus(tdb, prebuildEventId, status),
    );
  };

const createWorkspace: ActivitiesCreateFns["createWorkspace"] =
  ({ injector, db }: Args) =>
  async (args: {
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

const startWorkspace: ActivitiesCreateFns["startWorkspace"] =
  ({ injector, db }: Args) =>
  async (workspaceId: bigint): Promise<WorkspaceInstance> => {
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
        prebuildEvent: {
          include: {
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
        },
        user: {
          include: {
            sshPublicKeys: true,
          },
        },
      },
    });
    const userEnvVarSet = await db.userProjectEnvironmentVariableSet.findUnique({
      where: {
        // eslint-disable-next-line camelcase
        userId_projectId: {
          userId: workspace.userId,
          projectId: workspace.prebuildEvent.projectId,
        },
      },
      include: {
        environmentSet: {
          include: {
            environmentVariables: true,
          },
        },
      },
    });
    const projectEnvVariables =
      workspace.prebuildEvent.project.environmentVariableSet.environmentVariables.map(
        (v) => [v.name, v.value] as const,
      );
    const userVariables =
      userEnvVarSet != null
        ? userEnvVarSet.environmentSet.environmentVariables.map((v) => [v.name, v.value] as const)
        : [];
    const environmentVariables = Array.from(
      new Map([...projectEnvVariables, ...userVariables]).entries(),
    ).map(([name, value]) => ({ name, value }));

    const instanceInfo = await workspaceAgentService.startWorkspace({
      fcInstanceId,
      filesystemDrivePath: workspace.rootFsFile.path,
      projectDrivePath: workspace.projectFile.path,
      authorizedKeys: workspace.user.sshPublicKeys.map((k) => k.publicKey),
      tasks: workspace.prebuildEvent.workspaceTasks,
      environmentVariables,
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

const stopWorkspace: ActivitiesCreateFns["stopWorkspace"] =
  ({ injector, db }: Args) =>
  async (workspaceId: bigint): Promise<void> => {
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

const getProjectsAndGitObjects: ActivitiesCreateFns["getProjectsAndGitObjects"] =
  ({ db }: Args) =>
  async (
    projectIds: bigint[],
    gitObjectIds: bigint[],
  ): Promise<{ projects: Project[]; gitObjects: GitObject[] }> => {
    const projects = await db.project.findMany({
      where: { id: { in: projectIds } },
    });
    if (projects.length !== projectIds.length) {
      throw new Error("Some projects were not found");
    }
    const gitObjects = await db.gitObject.findMany({
      where: { id: { in: gitObjectIds } },
    });
    if (gitObjects.length !== gitObjectIds.length) {
      throw new Error("Some git objects were not found");
    }
    return { projects, gitObjects };
  };

const getOrCreateBuildfsEvents: ActivitiesCreateFns["getOrCreateBuildfsEvents"] =
  ({ injector, db }: Args) =>
  async (
    args: {
      contextPath: string;
      dockerfilePath: string;
      cacheHash: string | null;
      outputFilePath: string;
      projectFilePath: string;
      projectId: bigint;
    }[],
  ): Promise<GetOrCreateBuildfsEventsReturnType[]> => {
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

const createPrebuildEvents: ActivitiesCreateFns["createPrebuildEvents"] =
  ({ injector, db }: Args) =>
  async (
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

const createPrebuildFiles: ActivitiesCreateFns["createPrebuildFiles"] =
  ({ injector, db }: Args) =>
  async (args: {
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

const getWorkspaceInstanceStatus: ActivitiesCreateFns["getWorkspaceInstanceStatus"] =
  ({ injector, db }: Args) =>
  async (workspaceInstanceId: bigint): Promise<"on" | "off" | "paused" | "removed"> => {
    const workspace = await db.workspace.findFirst({
      where: { activeInstanceId: workspaceInstanceId },
      include: {
        activeInstance: true,
      },
    });
    if (workspace == null || workspace.status === WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP) {
      return "removed";
    }
    if (workspace.activeInstance == null) {
      throw new Error("impossible");
    }
    const firecrackerService = injector.resolve(Token.FirecrackerService)(
      workspace.activeInstance.firecrackerInstanceId,
    );
    const vmInfo = await firecrackerService.getVMInfo();
    if (vmInfo == null) {
      return "off";
    }
    return vmInfo.status;
  };

const addProjectAndRepository: ActivitiesCreateFns["addProjectAndRepository"] =
  ({ injector, db }: Args) =>
  async (args: {
    gitRepositoryUrl: string;
    projectName: string;
    projectWorkspaceRoot: string;
    sshKeyPairId?: bigint;
  }): Promise<{
    project: Project;
    gitRepository: GitRepository;
    gitRepositoryCreated: boolean;
  }> => {
    const gitService = injector.resolve(Token.GitService);
    const projectService = injector.resolve(Token.ProjectService);
    return await db.$transaction(async (tdb) => {
      const { gitRepository, wasCreated } = await gitService.addGitRepositoryIfNotExists(
        tdb,
        args.gitRepositoryUrl,
        args.sshKeyPairId,
      );
      const project = await projectService.createProject(tdb, {
        gitRepositoryId: gitRepository.id,
        name: args.projectName,
        rootDirectoryPath: args.projectWorkspaceRoot,
      });
      return { project, gitRepository, gitRepositoryCreated: wasCreated };
    });
  };

const getRepositoryProjects: ActivitiesCreateFns["getRepositoryProjects"] =
  ({ db }: Args) =>
  async (gitRepositoryId: bigint): Promise<Project[]> => {
    return await db.project.findMany({
      where: { gitRepositoryId },
      orderBy: { id: "asc" },
    });
  };

const updateGitBranchesAndObjects: ActivitiesCreateFns["updateGitBranchesAndObjects"] =
  ({ injector, db }: Args) =>
  async (gitRepositoryId: bigint): Promise<UpdateBranchesResult> => {
    const gitService = injector.resolve(Token.AgentGitService);
    return await gitService.updateBranches(db, gitRepositoryId);
  };

const getDefaultBranch: ActivitiesCreateFns["getDefaultBranch"] =
  ({ db }: Args) =>
  async (gitRepositoryId: bigint): Promise<GitBranch | null> => {
    const branches = await db.gitBranch.findMany({
      where: {
        gitRepositoryId,
        name: {
          in: ["refs/heads/main", "refs/heads/master"],
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    if (branches.length === 0) {
      return null;
    }
    return branches[0];
  };

export const createActivities = async (
  injector: ReturnType<typeof createAgentInjector>,
  db: Prisma.NonTransactionClient,
): Promise<Activities> => {
  const fns = {
    fetchRepository,
    buildfs,
    checkoutAndInspect,
    prebuild,
    cancelPrebuilds,
    changePrebuildEventStatus,
    createWorkspace,
    startWorkspace,
    stopWorkspace,
    getProjectsAndGitObjects,
    getOrCreateBuildfsEvents,
    createPrebuildEvents,
    createPrebuildFiles,
    getWorkspaceInstanceStatus,
    addProjectAndRepository,
    getRepositoryProjects,
    updateGitBranchesAndObjects,
    getDefaultBranch,
  } as const;

  return Object.fromEntries(
    Object.entries(fns).map(([name, fn]) => {
      return [name, fn({ injector, db })] as const;
    }),
  ) as any;
};
