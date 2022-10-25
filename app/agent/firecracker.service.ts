import { spawn } from "child_process";
import fs from "fs";

import { DefaultLogger } from "@temporalio/worker";
import { Configuration, DefaultApi } from "firecracker-client";
import { fetch } from "got-fetch";

export class FirecrackerService {
  private api: DefaultApi;
  private logger: DefaultLogger;

  constructor(public readonly pathToSocket: string) {
    this.logger = new DefaultLogger();
    this.api = new DefaultApi(
      new Configuration({
        basePath: `http://unix:${pathToSocket}:`,
        fetchApi: fetch as any,
      }),
    );
  }

  startFirecrackerInstance(outputFilepaths: { stdout: string; stderr: string }): number {
    this.logger.info("starting firecracker instance");
    const stdoutStream = fs.createWriteStream(outputFilepaths.stdout, {
      fd: fs.openSync(outputFilepaths.stdout, "w"),
    });
    const stderrStream = fs.createWriteStream(outputFilepaths.stderr, {
      fd: fs.openSync(outputFilepaths.stderr, "w"),
    });
    const child = spawn("firecracker", ["--api-sock", this.pathToSocket]);
    child.stdout.pipe(stdoutStream);
    child.stderr.pipe(stderrStream);
    if (child.pid == null) {
      throw new Error("Failed to start firecracker");
    }
    this.logger.info(`firecracker instance pid: ${child.pid}`);
    return child.pid;
  }

  async createVM() {
    await this.api.putLogger({
      body: {
        logPath: "/tmp/fc.log",
        level: "Warning",
        showLevel: false,
        showLogOrigin: false,
      },
    });
    this.logger.info("fc logger configured");
  }
}
