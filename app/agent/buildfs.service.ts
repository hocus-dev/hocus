import path from "path";

import type { BuildfsEvent, BuildfsEventFile, Prisma } from "@prisma/client";
import { Add, Copy, DockerfileParser } from "dockerfile-ast";
import type { NodeSSH } from "node-ssh";
import { Token } from "~/token";

import type { AgentUtilService } from "./agent-util.service";
import { execSshCmd } from "./utils";

export class BuildfsService {
  workdir = "/tmp/workdir" as const;
  buildfsScriptPath = `${this.workdir}/bin/buildfs.sh` as const;
  inputDir = "/tmp/input" as const;
  outputDir = "/tmp/output" as const;
  isUrlRegex = /^((git|ssh|https?):\/\/)|git@/;

  static inject = [Token.AgentUtilService] as const;
  constructor(private readonly agentUtilService: AgentUtilService) {}

  async createBuildfsEvent(
    db: Prisma.TransactionClient,
    args: { contextPath: string; dockerfilePath: string; cacheHash: string },
  ): Promise<BuildfsEvent> {
    const vmTask = await this.agentUtilService.createVmTask(db, [
      this.buildfsScriptPath,
      path.join(this.inputDir, "project", args.dockerfilePath),
      this.outputDir,
      path.join(this.inputDir, "project", args.contextPath),
    ]);
    return await db.buildfsEvent.create({
      data: {
        vmTaskId: vmTask.id,
        contextPath: args.contextPath,
        dockerfilePath: args.dockerfilePath,
        cacheHash: args.cacheHash,
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
    cacheHash: string,
    agentInstanceId: bigint,
  ): Promise<BuildfsEvent | null> {
    const buildfsFile = await db.buildfsEventFile.findFirst({
      where: {
        buildfsEvent: {
          cacheHash,
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
    },
  ): Promise<{ event: BuildfsEvent; status: "created" | "found" }> {
    const existingEvent = await this.getExistingBuildfsEvent(
      db,
      args.cacheHash,
      args.agentInstanceId,
    );
    if (existingEvent) {
      return { event: existingEvent, status: "found" };
    }
    const event = await this.createBuildfsEvent(db, args);
    return { event, status: "created" };
  }
}
