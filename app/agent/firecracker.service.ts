/* eslint-disable camelcase */
import { DefaultApi } from "firecracker-client";

export class FirecrackerService {
  private api: DefaultApi;

  constructor(pathToSocket: string) {
    this.api = new DefaultApi(void 0, `http://unix:${pathToSocket}`);
  }

  async createVM() {
    const response = await this.api.putGuestBootSource({
      kernel_image_path: "/home/centos/vmlinux.bin",
      boot_args: "console=ttyS0 reboot=k panic=1 pci=off",
    });
    console.log(response);
  }
}
