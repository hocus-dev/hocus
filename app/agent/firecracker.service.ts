import { spawn } from "child_process";
import fs from "fs";
import fsAsync from "fs/promises";
import path from "path";

import type { DefaultLogger } from "@temporalio/worker";
import type { FullVmConfiguration, PutGuestDriveByIDRequest } from "firecracker-client";
import { FetchError } from "firecracker-client";
import { InstanceActionInfoActionTypeEnum } from "firecracker-client";
import { Configuration, DefaultApi } from "firecracker-client";
import { Netmask } from "netmask";
import type { Config as SSHConfig, NodeSSH } from "node-ssh";
import { match } from "ts-pattern";
import { fetch, Agent } from "undici";

import type { AgentUtilService } from "./agent-util.service";
import { JAILER_GROUP_ID, JAILER_USER_ID, MAX_UNIX_SOCKET_PATH_LENGTH } from "./constants";
import { FifoFlags } from "./fifo-flags";
import { MAXIMUM_IP_ID, MINIMUM_IP_ID } from "./storage/constants";
import type { StorageService } from "./storage/storage.service";
import { execCmd, execSshCmd, retry, watchFileUntilLineMatches, withSsh } from "./utils";
import type { VmInfo } from "./vm-info.validator";
import { VmInfoValidator } from "./vm-info.validator";

import type { Config } from "~/config";
import type { PerfService } from "~/perf.service.server";
import { Token } from "~/token";
import { displayError, numericSort, unwrap } from "~/utils.shared";

const IP_PREFIX = "10.231.";
const NS_PREFIX = ["ip", "netns", "exec", "vms"] as const;
const TAP_DEVICE_NAME_PREFIX = "vm";
const TAP_DEVICE_CIDR = 30;
const CHROOT_PATH_TO_SOCK = "/run/sock";

export function factoryFirecrackerService(
  storageService: StorageService,
  agentUtilService: AgentUtilService,
  logger: DefaultLogger,
  config: Config,
  perfService: PerfService,
): (instanceId: string) => FirecrackerService {
  return (instanceId: string) =>
    new FirecrackerService(
      storageService,
      agentUtilService,
      logger,
      config,
      perfService,
      instanceId,
    );
}
factoryFirecrackerService.inject = [
  Token.StorageService,
  Token.AgentUtilService,
  Token.Logger,
  Token.Config,
  Token.PerfService,
] as const;

export class FirecrackerService {
  private api: DefaultApi;
  private readonly pathToSocket: string;
  private readonly instanceDir: string;
  private readonly instanceDirRoot: string;
  private readonly vmInfoFilePath: string;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly storageService: StorageService,
    private readonly agentUtilService: AgentUtilService,
    private readonly logger: DefaultLogger,
    private readonly config: Config,
    private readonly perfService: PerfService,
    public readonly instanceId: string,
  ) {
    this.agentConfig = config.agent();
    this.instanceDir = `/srv/jailer/firecracker/${instanceId}`;
    this.instanceDirRoot = `${this.instanceDir}/root`;
    this.vmInfoFilePath = `${this.instanceDirRoot}/vm-info.json`;
    this.pathToSocket = path.join(this.instanceDirRoot, CHROOT_PATH_TO_SOCK);
    if (this.pathToSocket.length > MAX_UNIX_SOCKET_PATH_LENGTH) {
      // https://blog.8-p.info/en/2020/06/11/unix-domain-socket-length/
      throw new Error(
        "Instance ID is too long. Length of the path to the socket exceeds the maximum on Linux.",
      );
    }
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

  async startFirecrackerInstance(): Promise<number> {
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
        JAILER_USER_ID,
        "--gid",
        JAILER_GROUP_ID,
        "--netns",
        "/var/run/netns/vms",
        "--exec-file",
        "/usr/local/bin/firecracker",
        "--",
        "--api-sock",
        CHROOT_PATH_TO_SOCK,
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
      this.logger.error(`firecracker process errored: ${displayError(err)}`);
    });
    child.on("close", (code) => {
      this.logger.warn(`firecracker process with pid ${child.pid} closed: ${code}`);
    });

    if (child.pid == null) {
      throw new Error("Failed to start firecracker");
    }

    this.logger.info(`firecracker process started with pid ${child.pid}`);

    // Wait for the socket to be created
    try {
      // TODO: use innotify for this
      await retry(async () => await fsAsync.stat(this.pathToSocket), 1000, 5);
    } catch (err) {
      this.logger.error(
        `Timeout waiting for firecracker to create a socket at ${this.pathToSocket}`,
      );
      throw err;
    }

    this.logger.info(`firecracker instance pid: ${child.pid}`);
    return child.pid;
  }

  private async getFreeIpBlockId(): Promise<number> {
    const ipId = await this.storageService.withStorage(async (storage) => {
      const container = await storage.readStorage();
      const busyIpBlockIds = container.busyIpBlockIds;
      busyIpBlockIds.sort(numericSort);
      let nextFreeIpId = MINIMUM_IP_ID;
      for (const busyIpBlockId of busyIpBlockIds) {
        if (busyIpBlockId !== nextFreeIpId) {
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

  private linkToJailerChroot(filePath: string, relativePathInChroot: string): void {
    const chrootPath = path.join(this.instanceDirRoot, relativePathInChroot);
    execCmd("ln", filePath, chrootPath);
    execCmd("chown", `${JAILER_USER_ID}:${JAILER_GROUP_ID}`, chrootPath);
  }

  private copyToJailerChroot(filePath: string, relativePathInChroot: string): void {
    const chrootPath = path.join(this.instanceDirRoot, relativePathInChroot);
    execCmd("cp", filePath, chrootPath);
    execCmd("chown", `${JAILER_USER_ID}:${JAILER_GROUP_ID}`, chrootPath);
  }

  /**
   * Paths to kernel and drives should be absolute. They will be hardlinked or copied
   * to the jailer's chroot directory and paths supplied to firecracker will be
   * properly modified.
   */
  async createVM(cfg: {
    kernelPath: string;
    rootFsPath: string;
    vmIp: string;
    tapDeviceIp: string;
    tapDeviceName: string;
    tapDeviceCidr: number;
    extraDrives: (PutGuestDriveByIDRequest["body"] & {
      /**
       * By default the drive is hard linked into a firecracker-managed directory.
       * If set to to `true`, the drive will be copied instead.
       * */
      copy?: boolean;
    })[];
    /**
     * By default the root fs is hard linked into a firecracker-managed directory.
     * If set to to `true`, the root fs will be copied instead.
     * */
    copyRootFs?: boolean;
    memSizeMib: number;
    vcpuCount: number;
  }): Promise<FullVmConfiguration> {
    const mask = new Netmask(`255.255.255.255/${cfg.tapDeviceCidr}`).mask;
    const ipArg = `ip=${cfg.vmIp}::${cfg.tapDeviceIp}:${mask}::eth0:off`;

    const chrootKernelPath = "/kernel.bin";
    const chrootRootFsPath = "/rootfs.ext4";

    const t1 = performance.now();
    this.linkToJailerChroot(cfg.kernelPath, chrootKernelPath);
    const shouldCopyRootFs = cfg.copyRootFs ?? false;
    if (shouldCopyRootFs) {
      this.copyToJailerChroot(cfg.rootFsPath, chrootRootFsPath);
    } else {
      this.linkToJailerChroot(cfg.rootFsPath, chrootRootFsPath);
    }
    for (const [idx, drive] of cfg.extraDrives.entries()) {
      const shouldCopyFs = drive.copy ?? false;
      if (shouldCopyFs) {
        this.copyToJailerChroot(drive.pathOnHost, `/drive${idx}`);
      } else {
        this.linkToJailerChroot(drive.pathOnHost, `/drive${idx}`);
      }
    }
    this.logger.info(`Setting up the FS took ${(performance.now() - t1).toFixed(2)}`);

    await this.api.putGuestBootSource({
      body: {
        kernelImagePath: chrootKernelPath,
        bootArgs: `ro console=ttyS0 noapic reboot=k panic=1 pci=off nomodules random.trust_cpu=on ${ipArg}`,
      },
    });
    await this.api.putGuestDriveByID({
      driveId: "rootfs",
      body: {
        driveId: "rootfs",
        pathOnHost: chrootRootFsPath,
        isReadOnly: false,
        isRootDevice: true,
      },
    });
    for (const [idx, drive] of cfg.extraDrives.entries()) {
      await this.api.putGuestDriveByID({
        driveId: drive.driveId,
        body: { ...drive, pathOnHost: `/drive${idx}` },
      });
    }
    await this.api.putGuestNetworkInterfaceByID({
      ifaceId: "eth0",
      body: { ifaceId: "eth0", hostDevName: cfg.tapDeviceName },
    });
    await this.api.putMachineConfiguration({
      body: {
        vcpuCount: cfg.vcpuCount,
        memSizeMib: cfg.memSizeMib,
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

  async writeVmInfoFile(args: { pid: number; ipBlockId: number }): Promise<void> {
    const vmInfo: VmInfo = {
      ...args,
      instanceId: this.instanceId,
    };
    await fsAsync.writeFile(this.vmInfoFilePath, JSON.stringify(vmInfo));
  }

  async readVmInfoFile(): Promise<VmInfo> {
    const contents = await fsAsync.readFile(this.vmInfoFilePath);
    return VmInfoValidator.Parse(JSON.parse(contents.toString()));
  }

  /**
   * If the instance files are on disk, returns the result object.
   * If the instance does not exist on disk, returns null.
   * */
  async getVMInfo(): Promise<{ status: "on" | "off" | "paused"; info: VmInfo } | null> {
    const info = await this.readVmInfoFile().catch((err) => {
      if (err?.code === "ENOENT") {
        return null;
      }
      throw err;
    });
    if (info === null) {
      return null;
    }
    const state = await this.api
      .describeInstance()
      .then((res) => res.state)
      .catch((err) => {
        if (err instanceof FetchError && (err.cause as any)?.cause?.code === "ECONNREFUSED") {
          return null;
        }
        throw err;
      });
    return {
      status: match(state)
        .with("Running", () => "on" as const)
        .with("Paused", () => "paused" as const)
        .with("Not started", () => "off" as const)
        .with(null, () => "off" as const)
        .exhaustive(),
      info,
    };
  }

  async withVM<T>(
    config: {
      ssh: Omit<SSHConfig, "host">;
      kernelPath?: string;
      rootFsPath: string;
      copyRootFs?: boolean;
      /**
       * Paths to extra drives to attach to the VM.
       */
      extraDrives?: {
        pathOnHost: string;
        guestMountPath: string;
        /**
         * If true, the drive will be copied instead of hard linked.
         */
        copy?: boolean;
      }[];
      /**
       * Defaults to true.
       */
      shouldPoweroff?: boolean;
      /** Defaults to true. */
      removeVmDirAfterPoweroff?: boolean;
      memSizeMib: number;
      vcpuCount: number;
    },
    fn: (args: {
      ssh: NodeSSH;
      sshConfig: SSHConfig;
      firecrackerPid: number;
      vmIp: string;
      ipBlockId: number;
    }) => Promise<T>,
  ): Promise<T> {
    const kernelPath = config.kernelPath ?? this.agentConfig.defaultKernel;
    const shouldPoweroff = config.shouldPoweroff ?? true;
    let vmStarted = false;
    const extraDrives = config.extraDrives ?? [];
    const t1 = performance.now();
    const fcPid = await this.startFirecrackerInstance();
    const t2 = performance.now();
    this.logger.info(
      `Starting firecracker process with pid ${fcPid} took: ${(t2 - t1).toFixed(2)} ms`,
    );
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
        copyRootFs: config.copyRootFs,
        extraDrives: extraDrives.map(({ pathOnHost, copy }, idx) => ({
          driveId: `drive${idx}`,
          pathOnHost: pathOnHost,
          copy,
          isReadOnly: false,
          isRootDevice: false,
        })),
        memSizeMib: config.memSizeMib,
        vcpuCount: config.vcpuCount,
      });
      vmStarted = true;
      const t3 = performance.now();
      this.logger.info(
        `Booting firecracker VM with pid ${fcPid} took: ${(t3 - t2).toFixed(2)} ms, TOTAL: ${(
          t3 - t1
        ).toFixed(2)} ms`,
      );
      await this.writeVmInfoFile({ pid: fcPid, ipBlockId });
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
        const r = await fn({
          ssh,
          sshConfig,
          firecrackerPid: fcPid,
          vmIp,
          ipBlockId: unwrap(ipBlockId),
        });

        this.perfService.log(fcPid, "withVM exit start");
        // Ensure the page cache is flushed before proceeding
        await execSshCmd({ ssh }, ["sync"]);

        return r;
      });
    } finally {
      if (shouldPoweroff && vmStarted) {
        await this.shutdownVM();
      }
      if (shouldPoweroff && ipBlockId !== null) {
        await this.releaseVmResources(ipBlockId);
      }
      if (shouldPoweroff && config.removeVmDirAfterPoweroff !== false) {
        await this.tryDeleteVmDir();
      }
      this.perfService.log(fcPid, "withVM exit end");
    }
  }

  /**
   * Only works if the VM kernel is compiled with support for
   * `CONFIG_SERIO_I8042` and `CONFIG_KEYBOARD_ATKBD` as per
   * https://github.com/firecracker-microvm/firecracker/blob/2b8ad83629af511f918d616aa1c0d441e52c397a/docs/api_requests/actions.md#intel-and-amd-only-sendctrlaltdel
   *
   * Waits for the VM to shutdown.
   */
  async shutdownVM(): Promise<void> {
    await this.api.createSyncAction({
      info: {
        actionType: InstanceActionInfoActionTypeEnum.SendCtrlAltDel,
      },
    });
    await watchFileUntilLineMatches(/reboot: Restarting system/, this.getVMLogsPath(), 30000);
  }

  async releaseVmResources(ipBlockId: number): Promise<void> {
    try {
      await this.changeVMNetworkVisibility(ipBlockId, "private");
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Bad rule"))) {
        throw err;
      }
    }
    await this.releaseIpBlockId(ipBlockId);
  }

  async tryDeleteVmDir(): Promise<void> {
    try {
      await fsAsync.rm(this.instanceDir, { recursive: true, force: true });
    } catch (err) {
      this.logger.error(`failed to delete vm dir ${this.instanceDir}: ${displayError(err)}`);
    }
  }

  changeVMNetworkVisibility(ipBlockId: number, changeTo: "public" | "private"): void {
    const action = changeTo === "public" ? "-A" : "-D";
    for (const cmd of [
      `iptables ${action} FORWARD -i vpeer-ssh-vms -o vm${ipBlockId} -p tcp --dport 22 -j ACCEPT`,
      `iptables ${action} FORWARD -i vm${ipBlockId} -o vpeer-ssh-vms -m state --state ESTABLISHED,RELATED -j ACCEPT`,
    ]) {
      execCmd(...NS_PREFIX, ...cmd.split(" "));
    }
  }
}
