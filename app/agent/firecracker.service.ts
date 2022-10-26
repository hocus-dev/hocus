import { spawn, spawnSync } from "child_process";
import fs from "fs";

import { DefaultLogger } from "@temporalio/worker";
import type { FullVmConfiguration } from "firecracker-client";
import { Configuration, DefaultApi } from "firecracker-client";
import { Netmask } from "netmask";
import { fetch, Agent } from "undici";
import { unwrap } from "~/utils.shared";

import { execCmd } from "./utils";

export class FirecrackerService {
  private api: DefaultApi;
  private logger: DefaultLogger;

  constructor(public readonly pathToSocket: string) {
    this.logger = new DefaultLogger();
    const customFetch: typeof fetch = (input, init) => {
      return fetch(input, {
        ...init,
        dispatcher: new Agent({ connect: { socketPath: pathToSocket } }),
      });
    };
    this.api = new DefaultApi(
      new Configuration({
        basePath: `http://localhost`,
        fetchApi: customFetch as any,
      }),
    );
  }

  startFirecrackerInstance(outputFilepaths: { log: string }): number {
    this.logger.info(`starting firecracker instance with socket at ${this.pathToSocket}`);
    if (fs.existsSync(this.pathToSocket)) {
      this.logger.info(`socket already exists at ${this.pathToSocket}, deleting`);
      fs.unlinkSync(this.pathToSocket);
    }

    const childStdout = fs.openSync(outputFilepaths.log, "a");
    const childStderr = fs.openSync(outputFilepaths.log, "a");
    const child = spawn("firecracker", ["--api-sock", this.pathToSocket], {
      stdio: ["ignore", childStdout, childStderr],
      detached: true,
    });
    child.unref();

    if (child.pid == null) {
      throw new Error("Failed to start firecracker");
    }
    this.logger.info(`firecracker instance pid: ${child.pid}`);
    return child.pid;
  }

  getDefaultInterface(): string {
    const lines = execCmd("route").stdout.toString().split("\n");
    const defaultRoute = lines.find((line) => line.includes("default"));
    if (defaultRoute == null) {
      throw new Error("Failed to find default route");
    }
    return unwrap(defaultRoute.split(" ").at(-1));
  }

  setupNetworking(args: {
    vmIp: string;
    tapDeviceName: string;
    tapDeviceIp: string;
    tapDeviceCidr: number;
  }): void {
    const defaultInterace = this.getDefaultInterface();

    try {
      execCmd("ip", "link", "del", args.tapDeviceName);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Cannot find device"))) {
        throw err;
      }
    }
    execCmd("ip", "tuntap", "add", "dev", args.tapDeviceName, "mode", "tap");
    execCmd("sysctl", "-w", `net.ipv4.conf.${args.tapDeviceName}.proxy_arp=1`);
    execCmd("sysctl", "-w", `net.ipv6.conf.${args.tapDeviceName}.disable_ipv6=1`);
    execCmd(
      "ip",
      "addr",
      "add",
      `${args.tapDeviceIp}/${args.tapDeviceCidr}`,
      "dev",
      args.tapDeviceName,
    );
    execCmd("ip", "link", "set", "dev", args.tapDeviceName, "up");

    const targetIptablesRules = [
      `FORWARD -i ${args.tapDeviceName} -o ${defaultInterace} -j ACCEPT`,
      "FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT",
      `POSTROUTING -o ${defaultInterace} -j MASQUERADE -t nat`,
    ];
    for (const rule of targetIptablesRules) {
      const result = spawnSync("iptables", ["-C", ...rule.split(" ")]);
      const output = result.output?.toString() ?? "";
      if (result.status === 0) {
        // Rule already exists
        continue;
      } else if (!output.includes("Bad rule")) {
        throw new Error(`Failed to check iptables rule: ${rule}`);
      }

      execCmd("iptables", "-A", ...rule.split(" "));
    }
    return;
  }

  async createVM(cfg: {
    kernelPath: string;
    fsPath: string;
    vmIp: string;
    tapDeviceIp: string;
    tapDeviceName: string;
    tapDeviceCidr: number;
  }): Promise<FullVmConfiguration> {
    const mask = new Netmask(`255.255.255.255/${cfg.tapDeviceCidr}`).mask;
    const ipArg = `ip=${cfg.vmIp}::${cfg.tapDeviceIp}:${mask}::eth0:off`;
    await this.api.putGuestBootSource({
      body: {
        kernelImagePath: cfg.kernelPath,
        bootArgs: `ro console=ttyS0 noapic reboot=k panic=1 pci=off nomodules random.trust_cpu=on ${ipArg}`,
      },
    });
    await this.api.putGuestDriveByID({
      driveId: "rootfs",
      body: {
        driveId: "rootfs",
        pathOnHost: cfg.fsPath,
        isReadOnly: false,
        isRootDevice: true,
      },
    });
    await this.api.putGuestNetworkInterfaceByID({
      ifaceId: "eth0",
      body: { ifaceId: "eth0", hostDevName: cfg.tapDeviceName },
    });
    await this.api.createSyncAction({
      info: {
        actionType: "InstanceStart",
      },
    });
    const vmConfig = await this.api.getExportVmConfig();
    this.logger.info(`vm started: ${JSON.stringify(vmConfig, null, 2)}`);
    return vmConfig;
  }
}
