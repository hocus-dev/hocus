import path from "path";

import type { BuildfsEvent, Prisma } from "@prisma/client";
import { Token } from "~/token";

import type { AgentUtilService } from "./agent-util.service";

export class BuildfsService {
  workdir = "/tmp/workdir" as const;
  buildfsScriptPath = `${this.workdir}/bin/buildfs.sh` as const;
  inputDir = "/tmp/input" as const;
  outputDir = "/tmp/output" as const;

  static inject = [Token.AgentUtilService] as const;
  constructor(private readonly agentUtilService: AgentUtilService) {}

  async createBuildfsEvent(
    db: Prisma.TransactionClient,
    args: { contextPath: string; dockerfilePath: string },
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
      },
    });
  }
}
