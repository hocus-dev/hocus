import path from "path";

import type { BuildfsEvent, Prisma } from "@prisma/client";
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
        `echo "$FILES" | xargs -d '\\n' -I _ find _ -type f -exec sha256sum {} \\; | cut -d ' ' -f 1 | sha256sum | cut -d ' ' -f 1`,
      ],
    );
    if (out.stderr !== "") {
      throw new Error(out.stderr);
    }
    return out.stdout.trim();
  }
}
