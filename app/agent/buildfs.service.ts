import fs from "fs/promises";
import path from "path";

import type { BuildfsEvent, BuildfsEventFiles, Prisma } from "@prisma/client";
import { VmTaskStatus } from "@prisma/client";
import { Add, Copy, DockerfileParser } from "dockerfile-ast";
import type { NodeSSH } from "node-ssh";
import type { Config } from "~/config";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import type { AgentUtilService } from "./agent-util.service";
import { HOST_PERSISTENT_DIR } from "./constants";
import type { FirecrackerService } from "./firecracker.service";
import { doesFileExist, execSshCmd, withFileLock } from "./utils";

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

  static inject = [Token.AgentUtilService, Token.Config] as const;
  constructor(private readonly agentUtilService: AgentUtilService, config: Config) {
    this.agentConfig = config.agent();
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
    const vmTask = await this.agentUtilService.createVmTask(db, {
      command: [
        this.buildfsScriptPath,
        path.join(this.inputDir, "project", project.rootDirectoryPath, args.dockerfilePath),
        this.outputDir,
        path.join(this.inputDir, "project", project.rootDirectoryPath, args.contextPath),
      ],
      cwd: this.workdir,
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
    const projectFile = await db.file.upsert({
      where: {
        // eslint-disable-next-line camelcase
        agentInstanceId_path: {
          agentInstanceId: args.agentInstanceId,
          path: args.projectFilePath,
        },
      },
      create: {
        agentInstanceId: args.agentInstanceId,
        path: args.projectFilePath,
      },
      update: {},
    });
    const outputFile = await db.file.create({
      data: {
        agentInstanceId: args.agentInstanceId,
        path: args.outputFilePath,
      },
    });
    return await db.buildfsEventFiles.create({
      data: {
        buildfsEventId: args.buildfsEventId,
        projectFileId: projectFile.id,
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
        "/bin/bash",
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

  /**
   * Returns the path to the rootfs drive.
   */
  private async getOrCreateRootFsDriveForProject(projectExternalId: string): Promise<string> {
    const buildfsDrivesDir = path.join(HOST_PERSISTENT_DIR, "buildfs-drives");
    const drivePath = path.join(buildfsDrivesDir, `${projectExternalId}.ext4`);
    const lockPath = path.join(buildfsDrivesDir, `${projectExternalId}.lock`);
    await fs.mkdir(buildfsDrivesDir, { recursive: true });
    await fs.appendFile(lockPath, "");

    return await withFileLock(lockPath, async () => {
      if (await doesFileExist(drivePath)) {
        return drivePath;
      }
      await fs.copyFile(this.agentConfig.buildfsRootFs, drivePath);
      // We keep the drive image small to reduce the time it takes to copy it.
      // Copying 50GB would take a long time, like more than 30s. On the other hand,
      // expansion is fast, like less than a second fast, so we do it here.
      // Keep in mind that we are adding empty space - when not filled up,
      // it takes up almost no extra space on the host.
      await this.agentUtilService.expandDriveImage(drivePath, 50000);

      return drivePath;
    });
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
    firecrackerService: FirecrackerService;
    buildfsEventId: bigint;
  }): Promise<{ buildSuccessful: boolean }> {
    const agentInstance = await args.db.$transaction((tdb) =>
      this.agentUtilService.getOrCreateSoloAgentInstance(tdb),
    );
    const buildfsEvent = await args.db.buildfsEvent.findUniqueOrThrow({
      where: { id: args.buildfsEventId },
      include: {
        buildfsEventFiles: {
          include: {
            outputFile: true,
            projectFile: true,
          },
        },
        project: true,
      },
    });
    const files = unwrap(
      buildfsEvent.buildfsEventFiles.find((f) => f.agentInstanceId === agentInstance.id),
    );
    const outputFile = files.outputFile;
    const projectFile = files.projectFile;

    this.agentUtilService.createExt4Image(
      outputFile.path,
      buildfsEvent.project.maxPrebuildRootDriveSizeMib,
      true,
    );
    const rootfsDrivePath = await this.getOrCreateRootFsDriveForProject(
      buildfsEvent.project.externalId,
    );

    return await withFileLock(rootfsDrivePath, async () => {
      const result = await args.firecrackerService.withVM(
        {
          ssh: {
            username: "root",
            password: "root",
          },
          kernelPath: this.agentConfig.defaultKernel,
          rootFsPath: rootfsDrivePath,
          extraDrives: [
            { pathOnHost: outputFile.path, guestMountPath: this.outputDir },
            { pathOnHost: projectFile.path, guestMountPath: this.inputDir },
          ],
          memSizeMib: buildfsEvent.project.maxPrebuildRamMib,
          vcpuCount: buildfsEvent.project.maxPrebuildVCPUCount,
        },
        async ({ ssh, sshConfig }) => {
          const workdir = "/tmp/workdir";
          const buildfsScriptPath = `${workdir}/bin/buildfs.sh`;
          await execSshCmd({ ssh }, ["rm", "-rf", workdir]);
          await execSshCmd({ ssh }, ["mkdir", "-p", workdir]);
          await ssh.putDirectory(this.agentConfig.hostBuildfsResourcesDir, workdir);
          await execSshCmd({ ssh }, ["chmod", "+x", buildfsScriptPath]);

          const taskResults = await this.agentUtilService.execVmTasks(sshConfig, args.db, [
            { vmTaskId: buildfsEvent.vmTaskId },
          ]);
          return taskResults[0];
        },
      );

      return { buildSuccessful: result.status === VmTaskStatus.VM_TASK_STATUS_SUCCESS };
    });
  }
}
