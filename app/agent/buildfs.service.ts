import path from "path";

import type { BuildfsEvent, BuildfsEventFile, Prisma } from "@prisma/client";
import { VmTaskStatus } from "@prisma/client";
import { Add, Copy, DockerfileParser } from "dockerfile-ast";
import type { NodeSSH } from "node-ssh";
import type { Config } from "~/config";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import type { AgentUtilService } from "./agent-util.service";
import type { FirecrackerService } from "./firecracker.service";
import { execSshCmd } from "./utils";

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
    args: { contextPath: string; dockerfilePath: string; cacheHash: string; projectId: bigint },
  ): Promise<BuildfsEvent> {
    const vmTask = await this.agentUtilService.createVmTask(db, {
      command: [
        this.buildfsScriptPath,
        path.join(this.inputDir, "project", args.dockerfilePath),
        this.outputDir,
        path.join(this.inputDir, "project", args.contextPath),
      ],
      cwd: this.workdir,
    });
    return await db.buildfsEvent.create({
      data: {
        vmTaskId: vmTask.id,
        contextPath: args.contextPath,
        dockerfilePath: args.dockerfilePath,
        cacheHash: args.cacheHash,
        projectId: args.projectId,
      },
    });
  }

  async createBuildfsEventFile(
    db: Prisma.TransactionClient,
    args: { filePath: string; agentInstanceId: bigint; buildfsEventId: bigint },
  ): Promise<BuildfsEventFile> {
    const file = await db.file.create({
      data: {
        agentInstanceId: args.agentInstanceId,
        path: args.filePath,
      },
    });
    return await db.buildfsEventFile.create({
      data: {
        buildfsEventId: args.buildfsEventId,
        fileId: file.id,
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
      const isCopy = !isAdd && instruction instanceof Copy;
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
    const buildfsFile = await db.buildfsEventFile.findFirst({
      where: {
        buildfsEvent: {
          cacheHash,
          projectId,
        },
        file: {
          agentInstanceId,
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
      agentInstanceId: bigint;
      contextPath: string;
      dockerfilePath: string;
      cacheHash: string;
      fsFilePath: string;
      projectId: bigint;
    },
  ): Promise<{ event: BuildfsEvent; status: "created" | "found" }> {
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
    /** Path to a drive with a Dockerfile. */
    inputDrivePath: string;
    outputDriveMaxSizeMiB: number;
  }) {
    const agentInstance = await args.db.$transaction((tdb) =>
      this.agentUtilService.getOrCreateSoloAgentInstance(tdb),
    );
    const buildfsEvent = await args.db.buildfsEvent.findUniqueOrThrow({
      where: { id: args.buildfsEventId },
      include: {
        fsFiles: {
          include: {
            file: true,
          },
        },
      },
    });
    const outputFile = unwrap(
      buildfsEvent.fsFiles.find((f) => f.file.agentInstanceId === agentInstance.id),
    );

    this.agentUtilService.createExt4Image(outputFile.file.path, args.outputDriveMaxSizeMiB, true);

    const result = await args.firecrackerService.withVM(
      {
        ssh: {
          username: "root",
          password: "root",
        },
        kernelPath: this.agentConfig.defaultKernel,
        rootFsPath: this.agentConfig.buildfsRootFs,
        extraDrives: [
          { pathOnHost: outputFile.file.path, guestMountPath: this.outputDir },
          { pathOnHost: args.inputDrivePath, guestMountPath: this.inputDir },
        ],
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
  }
}
