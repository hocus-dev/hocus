import { Configuration, DefaultApi } from "firecracker-client";
import fetch from "node-fetch";

export class FirecrackerService {
  private api: DefaultApi;

  constructor(pathToSocket: string) {
    this.api = new DefaultApi(
      new Configuration({ basePath: `http://unix:${pathToSocket}`, fetchApi: fetch as any }),
    );
  }

  async createVM() {
    const response = await this.api.putGuestBootSource({
      body: {
        kernelImagePath: "/home/centos/vmlinux.bin",
        bootArgs: "console=ttyS0 reboot=k panic=1 pci=off",
      },
    });
    console.log(response);
  }
}
