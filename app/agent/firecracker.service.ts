import { DefaultLogger } from "@temporalio/worker";
import { Configuration, DefaultApi } from "firecracker-client";
import { fetch } from "got-fetch";

export class FirecrackerService {
  private api: DefaultApi;
  private logger: DefaultLogger;

  constructor(pathToSocket: string) {
    this.logger = new DefaultLogger();
    this.api = new DefaultApi(
      new Configuration({
        basePath: `http://unix:${pathToSocket}:`,
        fetchApi: fetch as any,
      }),
    );
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
