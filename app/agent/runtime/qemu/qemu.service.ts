import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

import type { DefaultLogger } from "@temporalio/worker";
import { Netmask } from "netmask";
import type { Config as SSHConfig, NodeSSH } from "node-ssh";
import { match } from "ts-pattern";
import { fetch, Agent } from "undici";

import type { AgentUtilService } from "../../agent-util.service";
import { JAILER_GROUP_ID, JAILER_USER_ID, MAX_UNIX_SOCKET_PATH_LENGTH } from "../../constants";
import { FifoFlags } from "../../fifo-flags";
import {
  doesFileExist,
  execCmd,
  execSshCmd,
  retry,
  watchFileUntilLineMatches,
  withSsh,
} from "../../utils";
import type { HocusRuntime } from "../hocus-runtime";
import type { VmInfo } from "../vm-info.validator";
import { VmInfoValidator } from "../vm-info.validator";

import type { IpBlockId, WorkspaceNetworkService } from "~/agent/network/workspace-network.service";
import { VMS_NS_PATH } from "~/agent/network/workspace-network.service";
import type { Config } from "~/config";
import type { PerfService } from "~/perf.service.server";
import { Token } from "~/token";
import { displayError, unwrap, waitForPromises } from "~/utils.shared";

const CHROOT_PATH_TO_SOCK = "/run/sock";
// https://github.com/torvalds/linux/blob/8b817fded42d8fe3a0eb47b1149d907851a3c942/include/uapi/linux/virtio_blk.h#L58
const VIRTIO_BLK_ID_BYTES = 20;

export function factoryQemuService(
  agentUtilService: AgentUtilService,
  logger: DefaultLogger,
  config: Config,
  perfService: PerfService,
  networkService: WorkspaceNetworkService,
): (instanceId: string) => HocusRuntime {
  return (instanceId: string) =>
    new QemuService(agentUtilService, logger, config, perfService, networkService, instanceId);
}
factoryQemuService.inject = [
  Token.AgentUtilService,
  Token.Logger,
  Token.Config,
  Token.PerfService,
  Token.WorkspaceNetworkService,
] as const;

export class QemuService implements HocusRuntime {
  private readonly pathToSocket: string;
  private readonly instanceDir: string;
  private readonly instanceDirRoot: string;
  private readonly vmInfoFilePath: string;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly agentUtilService: AgentUtilService,
    private readonly logger: DefaultLogger,
    private readonly config: Config,
    private readonly perfService: PerfService,
    private readonly networkService: WorkspaceNetworkService,
    public readonly instanceId: string,
  ) {
    this.agentConfig = config.agent();
    this.instanceDir = `/srv/jailer/qemu/${instanceId}`;
    this.instanceDirRoot = `${this.instanceDir}/root`;
    this.vmInfoFilePath = `${this.instanceDirRoot}/vm-info.json`;
    this.pathToSocket = path.join(this.instanceDirRoot, CHROOT_PATH_TO_SOCK);
    if (this.pathToSocket.length > MAX_UNIX_SOCKET_PATH_LENGTH) {
      // https://blog.8-p.info/en/2020/06/11/unix-domain-socket-length/
      throw new Error(
        "Instance ID is too long. Length of the path to the socket exceeds the maximum on Linux.",
      );
    }
  }

  private async getVirtioDeviceId(path: string) {
    // https://github.com/cloud-hypervisor/cloud-hypervisor/blob/6acceaa87cfd6327d99d212e3854cabf72c608cc/block_util/src/lib.rs#L82
    const st = await fs.stat(path);
    return `${st.dev}${st.rdev}${st.ino}`.substring(0, VIRTIO_BLK_ID_BYTES);
  }

  private getVMLogsPath(): string {
    return `/tmp/${this.instanceId}.log`;
  }

  private getStdinPath(): string {
    return `/tmp/${this.instanceId}.stdin`;
  }

  private async writeVmInfoFile(args: { pid: number; ipBlockId: number }): Promise<void> {
    const vmInfo: VmInfo = {
      ...args,
      instanceId: this.instanceId,
    };
    await fs.writeFile(this.vmInfoFilePath, JSON.stringify(vmInfo));
  }

  private async readVmInfoFile(): Promise<VmInfo> {
    const contents = await fs.readFile(this.vmInfoFilePath);
    return VmInfoValidator.Parse(JSON.parse(contents.toString()));
  }

  /**
   * If the instance files are on disk, returns the result object.
   * If the instance does not exist on disk, returns null.
   * */
  async getRuntimeInfo(): Promise<{ status: "on" | "off" | "paused"; info: VmInfo } | null> {
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

  async withRuntime<T>(
    config: {
      /**
       * SSH Configuration for connecting to the VM
       */
      ssh: Omit<SSHConfig, "host">;
      /**
       * Optional kernel for the runtime
       * Containers won't support changing the kernel
       */
      kernelPath?: string;
      /**
       * How should the final filesystem look like?
       * This is a map in the form <RUNTIME_PATH> -> <HOST_SPEC>
       * An entry for / is required
       */
      fs: Record<
        string,
        { device: string; readonly: boolean } | { mountPoint: string; readonly: boolean }
      >;
      /**
       * Defaults to true.
       */
      shouldPoweroff?: boolean;
      /** Defaults to true. */
      cleanupAfterStop?: boolean;
      memSizeMib: number;
      vcpuCount: number;
    },
    fn: (args: {
      ssh: NodeSSH;
      sshConfig: SSHConfig;
      runtimePid: number;
      vmIp: string;
      ipBlockId: IpBlockId;
    }) => Promise<T>,
  ): Promise<T> {
    const kernelPath = config.kernelPath ?? this.agentConfig.defaultKernel;
    const shouldPoweroff = config.shouldPoweroff ?? true;
    if (config.fs["/"] === void 0) {
      throw new Error("No root fs specified");
    }
    const diskPathToVirtioId: Record<string, string> = {};
    // This allows us to directly move the current code to cloud hypervisor
    await waitForPromises(
      Object.values(config.fs).map(async (what) => {
        if ("device" in what) {
          diskPathToVirtioId[what.device] = await this.getVirtioDeviceId(what.device);
        }
      }),
    );

    let vmStarted = false;
    let ipBlockId: null | IpBlockId = null;
    let fcPid: number;
    try {
      ipBlockId = await this.networkService.allocateIpBlock();
      const { tapIfCidr, tapIfIp, tapIfName, vmIp } = await this.networkService.setupInterfaces(
        ipBlockId,
      );
      const mask = new Netmask(`255.255.255.255/${tapIfCidr}`).mask;
      const ipArg = `${vmIp}::${tapIfIp}:${mask}::eth0:off`;

      let diskCtr = 1;
      const cp = spawn("qemu-system-x86_64", [
        "-machine",
        "q35,acpi=off",
        "-m",
        `${config.memSizeMib}M`,
        ...Object.values(config.fs).flatMap((what) => {
          if ("mountPoint" in what) {
            throw new Error("virtiofs unsupported for now");
          }
          diskCtr += 1;
          return [
            "-blockdev",
            `node-name=q${diskCtr},driver=raw,file.driver=host_device,file.filename=${
              what.device
            },discard=unmap,detect-zeroes=unmap,file.aio=io_uring${
              what.readonly ? ",readonly=on" : ""
            }`,
            "-device",
            `virtio-blk,drive=q${diskCtr},discard=on,serial=${diskPathToVirtioId[what.device]}`,
          ];
        }),
        "--kernel",
        kernelPath,
        "--append",
        `reboot=k noapic panic=1 nomodules random.trust_cpu=on root=/dev/disk/by-id/virtio-${
          diskPathToVirtioId["/"]
        } ${
          config.fs["/"].readonly ? "ro" : "rw"
        } rootflags=discard ip=${ipArg} console=ttyS0 damon_reclaim.enabled=Y damon_reclaim.min_age=30000000 damon_reclaim.wmarks_low=0 damon_reclaim.wmarks_high=1000 damon_reclaim.wmarks_mid=1000`,
        "-cpu",
        "host",
        "-smp",
        `${config.vcpuCount}`,
        "-nographic",
        "-enable-kvm",
        "-no-reboot",
        "-netdev",
        `tap,ifname=${tapIfName},script=no,downscript=no,vhost=on,id=n1`,
        "-device",
        "virtio-net-pci,netdev=n1",
        "-device",
        "virtio-balloon,deflate-on-oom=on,free-page-reporting=on",
      ]);

      throw new Error("A");

      await this.createVM({
        kernelPath: kernelPath,
        rootFsPath: config.rootFsPath,
        vmIp,
        tapIfIp,
        tapIfName,
        tapIfCidr,
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
        const mountTasks: Promise<void>[] = [];
        for (const drive of extraDrives) {
          mountTasks.push(
            this.agentUtilService.mountDriveAtPath(
              ssh,
              drive.pathOnHost,
              drive.guestMountPath,
              useSudo,
            ),
          );
        }
        await waitForPromises(mountTasks);
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
        await this.networkService.freeIpBlock(ipBlockId);
      }
      if (shouldPoweroff && config.removeVmDirAfterPoweroff !== false) {
        await this.deleteVMDir();
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

  async deleteVMDir(): Promise<void> {
    await fs.rm(this.instanceDir, { recursive: true, force: true });
  }

  /** Stops the VM and cleans up its resources. Idempotent. */
  async cleanup(): Promise<void> {
    const vmInfo = await this.getVMInfo();
    if (vmInfo?.status === "on") {
      await this.shutdownVM();
    }
    if (vmInfo != null) {
      await this.networkService.freeIpBlock(vmInfo.info.ipBlockId as IpBlockId);
    }
    await this.deleteVMDir();
  }
}
