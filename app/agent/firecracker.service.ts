import { spawn } from "child_process";
import fs from "fs";

import type { DefaultLogger } from "@temporalio/worker";
import type { FullVmConfiguration, PutGuestDriveByIDRequest } from "firecracker-client";
import { Configuration, DefaultApi } from "firecracker-client";
import { Netmask } from "netmask";
import type { Config as SSHConfig, NodeSSH } from "node-ssh";
import { fetch, Agent } from "undici";
import type { Config } from "~/config";
import { Token } from "~/token";

import type { AgentUtilService } from "./agent-util.service";
import { FifoFlags } from "./fifo-flags";
import { MAXIMUM_IP_ID, MINIMUM_IP_ID } from "./storage/constants";
import type { StorageService } from "./storage/storage.service";
import { execCmd, execSshCmd, watchFileUntilLineMatches, withSsh } from "./utils";

const IP_PREFIX = "10.231.";
const NS_PREFIX = ["ip", "netns", "exec", "vms"] as const;
const TAP_DEVICE_NAME_PREFIX = "vm";
const TAP_DEVICE_CIDR = 30;

export function factoryFirecrackerService(
  storageService: StorageService,
  agentUtilService: AgentUtilService,
  logger: DefaultLogger,
  config: Config,
): (instanceId: string) => FirecrackerService {
  return (instanceId: string) =>
    new FirecrackerService(storageService, agentUtilService, logger, config, instanceId);
}
factoryFirecrackerService.inject = [
  Token.StorageService,
  Token.AgentUtilService,
  Token.Logger,
  Token.Config,
] as const;

export class FirecrackerService {
  private api: DefaultApi;
  private readonly pathToSocket: string;
  private readonly instanceDir: string;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly storageService: StorageService,
    private readonly agentUtilService: AgentUtilService,
    private readonly logger: DefaultLogger,
    private readonly config: Config,
    public readonly instanceId: string,
  ) {
    this.agentConfig = config.agent();
    this.instanceDir = `/srv/jailer/firecracker/${instanceId}/root`;
    this.pathToSocket = `${this.instanceDir}/run/firecracker.socket`;
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
    const child = spawn(
      "jailer",
      [
        "--id",
        this.instanceId,
        "--uid",
        "162137",
        "--gid",
        "162137",
        "--netns",
        "/var/run/netns/vms",
        "--exec-file",
        "/usr/local/bin/firecracker",
      ],
      {
        stdio: [childStdin, childStdout, childStderr],
        detached: true,
      },
    );
    child.unref();
    child.on("error", (err) => {
      // Without this block the error is handled by the nodejs process itself and makes it
      // exit with code 1 crashing everything
      this.logger.error(`firecracker process errored: ${err}`);
    });
    child.on("close", (code) => {
      this.logger.warn(`firecracker process closed: ${code}`);
    });

    if (child.pid == null) {
      throw new Error("Failed to start firecracker");
    }
    this.logger.info(`firecracker instance pid: ${child.pid}`);
    return child.pid;
  }

  private async getFreeIpBlockId(): Promise<number> {
    const ipId = await this.storageService.withStorage(async (storage) => {
      const container = await storage.readStorage();
      const busyIpBlockIds = container.busyIpBlockIds;
      busyIpBlockIds.sort();
      let nextFreeIpId = MINIMUM_IP_ID;
      for (const i of busyIpBlockIds.keys()) {
        if (busyIpBlockIds[i] !== nextFreeIpId) {
          break;
        }
        nextFreeIpId++;
      }
      if (nextFreeIpId > MAXIMUM_IP_ID) {
        throw new Error("No free IP addresses");
      }
      busyIpBlockIds.push(nextFreeIpId);
      await storage.writeStorage(container);
      return nextFreeIpId;
    });
    return ipId;
  }

  private async releaseIpBlockId(ipBlockId: number): Promise<void> {
    await this.storageService.withStorage(async (storage) => {
      const container = await storage.readStorage();
      container.busyIpBlockIds = container.busyIpBlockIds.filter((id) => id !== ipBlockId);
      await storage.writeStorage(container);
    });
  }

  private getIpsFromIpId(ipId: number): { tapDeviceIp: string; vmIp: string } {
    const netIpId = 4 * ipId;
    const tapDeviceIpId = netIpId + 1;
    const vmIpId = netIpId + 2;

    const tapFirstIpPart = (tapDeviceIpId & ((2 ** 8 - 1) << 8)) >> 8;
    const tapSecondIpPart = tapDeviceIpId & (2 ** 8 - 1);
    const vmFirstIpPart = (vmIpId & ((2 ** 8 - 1) << 8)) >> 8;
    const vmSecondIpPart = vmIpId & (2 ** 8 - 1);

    return {
      tapDeviceIp: `${IP_PREFIX}${tapFirstIpPart}.${tapSecondIpPart}`,
      vmIp: `${IP_PREFIX}${vmFirstIpPart}.${vmSecondIpPart}`,
    };
  }

  private getTapDeviceName(ipId: number): string {
    return `${TAP_DEVICE_NAME_PREFIX}${ipId}`;
  }

  setupNetworking(args: {
    tapDeviceName: string;
    tapDeviceIp: string;
    tapDeviceCidr: number;
  }): void {
    try {
      execCmd(...NS_PREFIX, "ip", "link", "del", args.tapDeviceName);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Cannot find device"))) {
        throw err;
      }
    }
    execCmd(...NS_PREFIX, "ip", "tuntap", "add", "dev", args.tapDeviceName, "mode", "tap");
    execCmd(...NS_PREFIX, "sysctl", "-w", `net.ipv4.conf.${args.tapDeviceName}.proxy_arp=1`);
    execCmd(...NS_PREFIX, "sysctl", "-w", `net.ipv6.conf.${args.tapDeviceName}.disable_ipv6=1`);
    execCmd(
      ...NS_PREFIX,
      "ip",
      "addr",
      "add",
      `${args.tapDeviceIp}/${args.tapDeviceCidr}`,
      "dev",
      args.tapDeviceName,
    );
    execCmd(...NS_PREFIX, "ip", "link", "set", "dev", args.tapDeviceName, "up");

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

    // this is an ugly hack, remove it in the next commit
    execCmd("ln", cfg.kernelPath, `${this.instanceDir}/kernel.bin`);
    execCmd("chown", "162137:162137", cfg.kernelPath);
    execCmd("chown", "162137:162137", `${this.instanceDir}/kernel.bin`);

    await this.api.putGuestBootSource({
      body: {
        kernelImagePath: "/kernel.bin",
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

  async withVM<T>(
    config: {
      ssh: Omit<SSHConfig, "host">;
      kernelPath?: string;
      rootFsPath: string;
      /**
       * Paths to extra drives to attach to the VM.
       */
      extraDrives?: { pathOnHost: string; guestMountPath: string }[];
      /**
       * Defaults to true.
       */
      shouldPoweroff?: boolean;
    },
    fn: (args: {
      ssh: NodeSSH;
      sshConfig: SSHConfig;
      firecrackerPid: number;
      vmIp: string;
    }) => Promise<T>,
  ): Promise<T> {
    const kernelPath = config.kernelPath ?? this.agentConfig.defaultKernel;
    const shouldPoweroff = config.shouldPoweroff ?? true;
    const extraDrives = config.extraDrives ?? [];
    const fcPid = this.startFirecrackerInstance();
    let ipBlockId: null | number = null;
    try {
      ipBlockId = await this.getFreeIpBlockId();
      const { vmIp, tapDeviceIp } = this.getIpsFromIpId(ipBlockId);
      const tapDeviceName = this.getTapDeviceName(ipBlockId);
      this.setupNetworking({
        tapDeviceName: tapDeviceName,
        tapDeviceIp: tapDeviceIp,
        tapDeviceCidr: TAP_DEVICE_CIDR,
      });
      await this.createVM({
        kernelPath: kernelPath,
        rootFsPath: config.rootFsPath,
        vmIp,
        tapDeviceIp,
        tapDeviceName,
        tapDeviceCidr: TAP_DEVICE_CIDR,
        extraDrives: extraDrives.map(({ pathOnHost }, idx) => ({
          driveId: `drive${idx}`,
          pathOnHost: pathOnHost,
          isReadOnly: false,
          isRootDevice: false,
        })),
      });
      const sshConfig = { ...config.ssh, host: vmIp };
      return await withSsh(sshConfig, async (ssh) => {
        const useSudo = config.ssh.username !== "root";
        for (const drive of extraDrives) {
          await this.agentUtilService.mountDriveAtPath(
            ssh,
            drive.pathOnHost,
            drive.guestMountPath,
            useSudo,
          );
        }
        const output = await fn({ ssh, sshConfig, firecrackerPid: fcPid, vmIp });
        if (shouldPoweroff) {
          const poweroffCmd = useSudo ? ["sudo", "poweroff"] : ["poweroff"];
          await execSshCmd({ ssh, allowNonZeroExitCode: true }, poweroffCmd);
          await watchFileUntilLineMatches(/reboot: System halted/, this.getVMLogsPath(), 10000);
        }
        return output;
      });
    } finally {
      if (shouldPoweroff) {
        process.kill(fcPid);
      }
      if (ipBlockId != null) {
        await this.releaseIpBlockId(ipBlockId);
      }
    }
  }
}
