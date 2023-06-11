import path from "path";

import type { BuildfsEvent, BuildfsEventFiles, Prisma, VmTask } from "@prisma/client";
import { VmTaskStatus } from "@prisma/client";
import { Add, Copy, DockerfileParser } from "dockerfile-ast";
import type { NodeSSH } from "node-ssh";

import type { AgentUtilService } from "./agent-util.service";
import type { BlockRegistryService, ImageId } from "./block-registry/registry.service";
import { EXPOSE_METHOD } from "./block-registry/registry.service";
import { withExposedImages } from "./block-registry/utils";
import type { HocusRuntime } from "./runtime/hocus-runtime";
import { LocalLockNamespace, execSshCmd, withLocalLock } from "./utils";

import type { Config } from "~/config";
import { Token } from "~/token";
import { getLogsFromGroup } from "~/utils.server";

export interface GetOrCreateBuildfsEventsReturnType {
  event: BuildfsEvent;
  status: "created" | "found";
}

export class BuildfsService {
  workdir = "/tmp/workdir" as const;
  buildfsScriptPath = `${this.workdir}/bin/buildfs.sh` as const;
  inputDir = "/tmp/input" as const;
  outputDir = "/tmp/output" as const;
  isUrlRegex = /^((git|ssh|https?):\/\/)|git@/;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  static inject = [Token.AgentUtilService, Token.BlockRegistryService, Token.Config] as const;
  constructor(
    private readonly agentUtilService: AgentUtilService,
    private readonly brService: BlockRegistryService,
    config: Config,
  ) {
    this.agentConfig = config.agent();
  }

  async createBuildfsVmTask(
    db: Prisma.TransactionClient,
    args: {
      relativeProjectRootDirPath: string;
      contextPath: string;
      dockerfilePath: string;
    },
  ): Promise<VmTask> {
    const projectRootDir = path.join(this.inputDir, "project", args.relativeProjectRootDirPath);
    return this.agentUtilService.createVmTask(db, {
      command: [
        this.buildfsScriptPath,
        path.join(projectRootDir, args.dockerfilePath),
        this.outputDir,
        path.join(projectRootDir, args.contextPath),
      ],
      cwd: this.workdir,
    });
  }

  async createBuildfsEvent(
    db: Prisma.TransactionClient,
    args: {
      agentInstanceId: bigint;
      projectFilePath: string;
      outputFilePath: string;
      /**
       * Path to the directory which will be used as context for the docker build.
       * Relative to the given project's directory.
       */
      contextPath: string;
      /** Path to the dockerfile. Relative to the given project's directory. */
      dockerfilePath: string;
      cacheHash: string;
      projectId: bigint;
    },
  ): Promise<BuildfsEvent> {
    const project = await db.project.findUniqueOrThrow({ where: { id: args.projectId } });
    const vmTask = await this.createBuildfsVmTask(db, {
      relativeProjectRootDirPath: project.rootDirectoryPath,
      contextPath: args.contextPath,
      dockerfilePath: args.dockerfilePath,
    });
    const buildfsEvent = await db.buildfsEvent.create({
      data: {
        vmTaskId: vmTask.id,
        contextPath: args.contextPath,
        dockerfilePath: args.dockerfilePath,
        cacheHash: args.cacheHash,
        projectId: args.projectId,
      },
    });
    await this.createBuildfsEventFiles(db, {
      projectFilePath: args.projectFilePath,
      outputFilePath: args.outputFilePath,
      agentInstanceId: args.agentInstanceId,
      buildfsEventId: buildfsEvent.id,
    });
    return buildfsEvent;
  }

  async createBuildfsEventFiles(
    db: Prisma.TransactionClient,
    args: {
      projectFilePath: string;
      outputFilePath: string;
      agentInstanceId: bigint;
      buildfsEventId: bigint;
    },
  ): Promise<BuildfsEventFiles> {
    const result = await db.$queryRaw<[{ id: bigint }]>`
      INSERT INTO "File" ("agentInstanceId", "path")
      VALUES (${args.agentInstanceId}, ${args.projectFilePath})
      ON CONFLICT ("agentInstanceId", "path")
      DO UPDATE SET "agentInstanceId" = ${args.agentInstanceId}
      RETURNING id`;
    const projectFileId = BigInt(result[0].id);
    const outputFile = await db.file.create({
      data: {
        agentInstanceId: args.agentInstanceId,
        path: args.outputFilePath,
      },
    });
    return await db.buildfsEventFiles.create({
      data: {
        buildfsEventId: args.buildfsEventId,
        projectFileId,
        outputFileId: outputFile.id,
        agentInstanceId: args.agentInstanceId,
      },
    });
  }

  private isUrl(str: string): boolean {
    return this.isUrlRegex.test(str);
  }

  getExternalFilePathsFromDockerfile(dockerfileContent: string): string[] {
    const dockerfile = DockerfileParser.parse(dockerfileContent);
    const instructions = dockerfile.getInstructions();
    const filePaths: string[] = [];
    for (const instruction of instructions) {
      const isAdd = instruction instanceof Add;
      const isCopy =
        !isAdd && instruction instanceof Copy && (instruction as Copy).getFromFlag() === null;
      if (isAdd || isCopy) {
        const args = instruction.getArguments();
        // the last item is the destination path
        for (const arg of args.slice(0, args.length - 1)) {
          const value = arg.getValue();
          if (isAdd && this.isUrl(value)) {
            continue;
          }
          filePaths.push(arg.getValue());
        }
      }
    }
    return filePaths;
  }

  async getSha256FromFiles(ssh: NodeSSH, workdir: string, filePaths: string[]): Promise<string> {
    for (const filePath of filePaths) {
      if (filePath.includes("\n")) {
        throw new Error("filePath cannot contain newline");
      }
    }
    if (filePaths.length === 0) {
      return "";
    }
    const out = await execSshCmd(
      {
        ssh,
        opts: {
          cwd: workdir,
          execOptions: {
            env: {
              FILES: filePaths.join("\n"),
            } as any,
          },
        },
      },
      [
        "/bin/sh",
        "-c",
        `echo "$FILES" | xargs -d '\\n' -I _ find _ -type f -exec sha256sum {} \\; | cut -d ' ' -f 1 | sort | sha256sum | cut -d ' ' -f 1`,
      ],
    );
    if (out.stderr !== "") {
      throw new Error(out.stderr);
    }
    return out.stdout.trim();
  }

  async getExistingBuildfsEvent(
    db: Prisma.Client,
    projectId: bigint,
    cacheHash: string,
    agentInstanceId: bigint,
  ): Promise<BuildfsEvent | null> {
    const buildfsFile = await db.buildfsEventFiles.findFirst({
      where: {
        agentInstanceId,
        buildfsEvent: {
          cacheHash,
          projectId,
          vmTask: {
            status: {
              notIn: [VmTaskStatus.VM_TASK_STATUS_CANCELLED, VmTaskStatus.VM_TASK_STATUS_ERROR],
            },
          },
        },
      },
      include: {
        buildfsEvent: true,
      },
    });
    if (buildfsFile != null) {
      return buildfsFile.buildfsEvent;
    }
    return null;
  }

  async getOrCreateBuildfsEvent(
    db: Prisma.TransactionClient,
    args: {
      outputFilePath: string;
      projectFilePath: string;
      agentInstanceId: bigint;
      contextPath: string;
      dockerfilePath: string;
      cacheHash: string;
      projectId: bigint;
    },
  ): Promise<GetOrCreateBuildfsEventsReturnType> {
    const existingEvent = await this.getExistingBuildfsEvent(
      db,
      args.projectId,
      args.cacheHash,
      args.agentInstanceId,
    );
    if (existingEvent) {
      return { event: existingEvent, status: "found" };
    }
    const event = await this.createBuildfsEvent(db, args);
    return { event, status: "created" };
  }

  async buildfs(args: {
    db: Prisma.NonTransactionClient;
    runtime: HocusRuntime;
    vmTaskId: bigint;
    memSizeMib: number;
    vcpuCount: number;
    /** Result of checkout and inspect. */
    repoImageId: ImageId;
    /** A new image will be created based on this id. */
    outputId: string;
  }): Promise<{ buildSuccessful: boolean; error?: string }> {
    const rootFsImageId = await this.brService.loadImageFromRemoteRepo(
      this.agentConfig.buildfsImageTag,
      "buildfs",
    );
    const rootFsContainerId = await this.brService.createContainer(rootFsImageId, "buildfs");
    // TODO: clean up this container when the block registry supports it
    const outputContainerId = await this.brService.createContainer(void 0, args.outputId, {
      mkfs: true,
      sizeInGB: 64,
    });

    const result = await withLocalLock(LocalLockNamespace.CONTAINER, "buildfs", () =>
      withExposedImages(
        this.brService,
        [
          [rootFsContainerId, EXPOSE_METHOD.BLOCK_DEV],
          [args.repoImageId, EXPOSE_METHOD.BLOCK_DEV],
          [outputContainerId, EXPOSE_METHOD.BLOCK_DEV],
        ] as const,
        async ([rootFsSpec, repoFsSpec, outputFsSpec]) =>
          args.runtime.withRuntime(
            {
              ssh: {
                username: "root",
                password: "root",
              },
              kernelPath: this.agentConfig.defaultKernel,
              fs: {
                "/": rootFsSpec,
                [this.inputDir]: repoFsSpec,
                [this.outputDir]: outputFsSpec,
              },
              memSizeMib: args.memSizeMib,
              vcpuCount: args.vcpuCount,
            },
            async ({ ssh, sshConfig }) => {
              const workdir = "/tmp/workdir";
              const buildfsScriptPath = `${workdir}/bin/buildfs.sh`;
              await execSshCmd({ ssh }, ["rm", "-rf", workdir]);
              await execSshCmd({ ssh }, ["mkdir", "-p", workdir]);
              await ssh.putDirectory(this.agentConfig.hostBuildfsResourcesDir, workdir);
              await execSshCmd({ ssh }, ["chmod", "+x", buildfsScriptPath]);

              const taskResults = await this.agentUtilService.execVmTasks(sshConfig, args.db, [
                { vmTaskId: args.vmTaskId },
              ]);
              return taskResults[0];
            },
          ),
      ),
    );

    const buildSuccessful = result.status === VmTaskStatus.VM_TASK_STATUS_SUCCESS;
    if (buildSuccessful) {
      await this.brService.commitContainer(outputContainerId, args.outputId);
      return { buildSuccessful };
    } else {
      const task = await args.db.vmTask.findUniqueOrThrow({
        where: { id: args.vmTaskId },
      });
      return {
        buildSuccessful,
        error: await getLogsFromGroup(args.db, task.logGroupId).then((b) => b.toString("utf-8")),
      };
    }
  }
}
