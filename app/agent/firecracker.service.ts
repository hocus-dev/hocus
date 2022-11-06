import { spawn, spawnSync } from "child_process";
import fs from "fs";

import type { DefaultLogger } from "@temporalio/worker";
import type { FullVmConfiguration, PutGuestDriveByIDRequest } from "firecracker-client";
import { Configuration, DefaultApi } from "firecracker-client";
import { Netmask } from "netmask";
import type { Config as SSHConfig, NodeSSH } from "node-ssh";
import { fetch, Agent } from "undici";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import { FifoFlags } from "./fifo-flags";
import type { StorageService } from "./storage/storage.service";
import { execCmd, execSshCmd, watchFileUntilLineMatches, withSsh } from "./utils";

const ipPrefix = "10.231.";

export function factoryFirecrackerService(
  storageService: StorageService,
  logger: DefaultLogger,
): (pathToSocket: string) => FirecrackerService {
  return (pathToSocket: string) => new FirecrackerService(storageService, logger, pathToSocket);
}
factoryFirecrackerService.inject = [Token.StorageService, Token.Logger] as const;

export class FirecrackerService {
  private api: DefaultApi;
  private readonly tapDeviceName = "hocus-tap";
  private readonly tapDeviceIp = `${ipPrefix}0.2` as const;
  private readonly tapDeviceCidr = 16;
  private readonly pathToSocket: string;

  constructor(
    private readonly storageService: StorageService,
    private readonly logger: DefaultLogger,
    public readonly instanceId: string,
  ) {
    this.pathToSocket = `/tmp/firecracker-${instanceId}.sock`;
    const customFetch: typeof fetch = (input, init) => {
      return fetch(input, {
        ...init,
        dispatcher: new Agent({ connect: { socketPath: this.pathToSocket } }),
      });
    };
    this.api = new DefaultApi(
      new Configuration({
        basePath: `http://localhost`,
        fetchApi: customFetch as any,
      }),
    );
  }

  getVMLogsPath(): string {
    return `/tmp/${this.instanceId}.log`;
  }

  getStdinPath(): string {
    return `/tmp/${this.instanceId}.stdin`;
  }

  startFirecrackerInstance(): number {
    this.logger.info(`starting firecracker instance with socket at ${this.pathToSocket}`);

    const stdinPath = this.getStdinPath();
    const logPath = this.getVMLogsPath();
    for (const path of [stdinPath, logPath, this.pathToSocket]) {
      if (fs.existsSync(path)) {
        this.logger.info(`file already exists at ${path}, deleting`);
        fs.unlinkSync(path);
      }
    }
    this.logger.info("opening stdin");
    execCmd("mkfifo", stdinPath);
    // The pipe is opened with O_RDWR even though the firecracker process only reads from it.
    // This is because of how FIFOs work in linux - when the last writer closes the pipe,
    // the reader gets an EOF. When the VM receives an EOF on the stdin, it detaches
    // serial input and we can no longer interact with its console. If we opened this pipe
    // as read only and later opened it again as a writer to run some commands, once we stopped
    // writing to it, the VM would receive an EOF and detach the serial input, making it impossible
    // to make any more writes. Since we open it as read/write here, there is always a writer and
    // the VM never receives an EOF.
    //
    // Learned how to open a FIFO here: https://github.com/firecracker-microvm/firecracker-go-sdk/blob/9a0d3b28f7f7ae1ac96e970dec4d28a09f10c4a9/machine.go#L742
    // Learned about read/write/EOF behaviour here: https://stackoverflow.com/a/40390938
    const childStdin = fs.openSync(stdinPath, FifoFlags.O_NONBLOCK | FifoFlags.O_RDWR, "0600");
    const childStdout = fs.openSync(logPath, "a");
    const childStderr = fs.openSync(logPath, "a");
    const child = spawn("firecracker", ["--api-sock", this.pathToSocket], {
      stdio: [childStdin, childStdout, childStderr],
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

  doesTapDeviceExist(tapName: string): boolean {
    const { stdout } = execCmd("ip", "tuntap", "list");
    const tapRegex = new RegExp(`^${tapName}:`);
    return stdout
      .toString()
      .split("\n")
      .some((line) => tapRegex.test(line));
  }

  /**
   * Retrieves a free ip address from the pool of available addresses.
   * The address is marked as busy in agent storage and will not be
   * returned again until it is released.
   */
  private async getFreeIpAddress(): Promise<string> {
    const ipAddress = await this.storageService.withStorage(async (storage) => {
      const container = await storage.readStorage();
      const busyIpIds = container.busyIpIds;
      busyIpIds.sort();
      let nextFreeIpId = 3;
      for (const i of busyIpIds.keys()) {
        if (busyIpIds[i] !== nextFreeIpId) {
          break;
        }
        nextFreeIpId++;
      }
      if (nextFreeIpId > 65534) {
        throw new Error("No free IP addresses");
      }
      busyIpIds.push(nextFreeIpId);
      await storage.writeStorage(container);
      const firstIpBlock = nextFreeIpId & ((2 ** 8 - 1) << 8);
      const secondIpBlock = nextFreeIpId & (2 ** 8 - 1);
      return `${ipPrefix}${firstIpBlock}.${secondIpBlock}`;
    });
    return ipAddress;
  }

  private async releaseIpAddress(ipAddress: string): Promise<void> {
    const ipBlocks = ipAddress
      .split(".")
      .slice(2)
      .map((block) => parseInt(block));
    const ipId = (ipBlocks[0] << 8) + ipBlocks[1];
    await this.storageService.withStorage(async (storage) => {
      const container = await storage.readStorage();
      container.busyIpIds = container.busyIpIds.filter((id) => id !== ipId);
      await storage.writeStorage(container);
    });
  }

  setupNetworking(args: {
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
    rootFsPath: string;
    vmIp: string;
    tapDeviceIp: string;
    tapDeviceName: string;
    tapDeviceCidr: number;
    extraDrives: PutGuestDriveByIDRequest["body"][];
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
        pathOnHost: cfg.rootFsPath,
        isReadOnly: false,
        isRootDevice: true,
      },
    });
    for (const drive of cfg.extraDrives) {
      await this.api.putGuestDriveByID({
        driveId: drive.driveId,
        body: drive,
      });
    }
    await this.api.putGuestNetworkInterfaceByID({
      ifaceId: "eth0",
      body: { ifaceId: "eth0", hostDevName: cfg.tapDeviceName },
    });
    await this.api.putMachineConfiguration({
      body: {
        vcpuCount: 2,
        memSizeMib: 4096,
        smt: true,
      },
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

  async withVM(
    config: {
      ssh: Omit<SSHConfig, "host">;
      /**
       * Defaults to `/hocus-resources/vmlinux-5.6-x86_64.bin`
       * if not specified.
       */
      kernelPath?: string;
      rootFsPath: string;
      /**
       * Paths to extra drives to attach to the VM.
       */
      extraDrives?: string[];
      /**
       * Defaults to true.
       */
      shouldPoweroff?: boolean;
    },
    fn: (args: { ssh: NodeSSH }) => Promise<void>,
  ): Promise<void> {
    const kernelPath = config.kernelPath ?? "/hocus-resources/vmlinux-5.6-x86_64.bin";
    const shouldPoweroff = config.shouldPoweroff ?? true;
    const fcPid = this.startFirecrackerInstance();
    let vmIpAddress: null | string = null;
    try {
      if (!this.doesTapDeviceExist(this.tapDeviceName)) {
        this.setupNetworking({
          tapDeviceName: this.tapDeviceName,
          tapDeviceIp: this.tapDeviceIp,
          tapDeviceCidr: this.tapDeviceCidr,
        });
      }
      vmIpAddress = await this.getFreeIpAddress();
      await this.createVM({
        kernelPath: kernelPath,
        rootFsPath: config.rootFsPath,
        vmIp: vmIpAddress,
        tapDeviceIp: this.tapDeviceIp,
        tapDeviceName: this.tapDeviceName,
        tapDeviceCidr: this.tapDeviceCidr,
        extraDrives: (config.extraDrives ?? []).map((drivePath, idx) => ({
          driveId: `drive${idx}`,
          pathOnHost: drivePath,
          isReadOnly: false,
          isRootDevice: false,
        })),
      });
      await withSsh({ ...config.ssh, host: vmIpAddress }, async (ssh) => {
        await fn({ ssh });
        if (shouldPoweroff) {
          const poweroffCmd = config.ssh.username === "root" ? ["poweroff"] : ["sudo", "poweroff"];
          await execSshCmd({ ssh, allowNonZeroExitCode: true }, poweroffCmd);
          await watchFileUntilLineMatches(/reboot: System halted/, this.getVMLogsPath(), 10000);
        }
      });
    } finally {
      process.kill(fcPid);
      if (vmIpAddress != null) {
        await this.releaseIpAddress(vmIpAddress);
      }
    }
  }
}
