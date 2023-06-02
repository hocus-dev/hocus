import { spawn } from "child_process";
import fs from "fs/promises";
import { Socket } from "net";
import path from "path";

import type { DefaultLogger } from "@temporalio/worker";
import { Netmask } from "netmask";
import type { Config as SSHConfig, NodeSSH } from "node-ssh";
import { match } from "ts-pattern";

import type { AgentUtilService } from "../../agent-util.service";
import { MAX_UNIX_SOCKET_PATH_LENGTH } from "../../constants";
import { FifoFlags } from "../../fifo-flags";
import { doesFileExist, execCmd, withSsh } from "../../utils";
import type { HocusRuntime } from "../hocus-runtime";
import type { VmInfo } from "../vm-info.validator";
import { VmInfoValidator } from "../vm-info.validator";

import type { IpBlockId, WorkspaceNetworkService } from "~/agent/network/workspace-network.service";
import { NS_PREFIX } from "~/agent/network/workspace-network.service";
import type { Config } from "~/config";
import type { PerfService } from "~/perf.service.server";
import { Token } from "~/token";
import { displayError, sleep, unwrap, waitForPromises } from "~/utils.shared";

export class QmpConnectionFailedError extends Error {}

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
  private readonly qmpSocketPath: string;
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
    this.qmpSocketPath = path.join(this.instanceDirRoot, CHROOT_PATH_TO_SOCK);
    if (this.qmpSocketPath.length > MAX_UNIX_SOCKET_PATH_LENGTH) {
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
    return `/srv/jailer/qemu/logs/${this.instanceId}.log`;
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

    let sock: Socket;
    try {
      sock = await this.qmpConnect();
    } catch (err: any) {
      if (err instanceof QmpConnectionFailedError) return null;
      throw err;
    }

    await this.sendQMPMessage(sock, "query-status");
    const m = await this.waitForQMPMessageWithTimeout(sock);
    if (m === void 0) {
      return null;
    }
    sock.destroy();
    return {
      status: match((m as any).return.status)
        .with("running", () => "on" as const)
        .with("suspended", () => "paused" as const)
        .with("paused", () => "paused" as const)
        .with("postmigrate", () => "paused" as const)
        .with("shutdown", () => "off" as const)
        .with("internal-error", () => "off" as const)
        .with("io-error", () => "off" as const)
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
    const t1 = performance.now();
    const kernelPath = config.kernelPath ?? this.agentConfig.defaultKernel;
    const shouldPoweroff = config.shouldPoweroff ?? true;
    let vmStarted = false;
    if (config.fs["/"] === void 0) {
      throw new Error("No root fs specified");
    }
    for (const path of Object.keys(config.fs)) {
      if (!path.startsWith("/")) {
        throw new Error("Mount target does not start with /");
      }
      if (path.includes("//")) {
        throw new Error("Mount target includes double /, please use a single one");
      }
    }
    const mountOrder = Object.entries(config.fs).sort(
      ([pathA, _a], [pathB, _b]) => pathA.split("/").length - pathB.split("/").length,
    );
    const diskPathToVirtioId: Record<string, string> = {};
    // This allows us to directly move the current code to cloud hypervisor
    await waitForPromises(
      mountOrder.map(async ([path, what]) => {
        if ("device" in what) {
          diskPathToVirtioId[path] = await this.getVirtioDeviceId(what.device);
        }
      }),
    );

    const stdinPath = this.getStdinPath();
    const logPath = this.getVMLogsPath();
    for (const filePath of [stdinPath, logPath, this.qmpSocketPath]) {
      if (path.dirname(filePath) !== "/tmp") {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
      }
      const pathExists = await doesFileExist(filePath);
      if (pathExists) {
        this.logger.info(`file already exists at ${filePath}, deleting`);
        await fs.unlink(filePath);
      }
    }

    const ipBlockId = await this.networkService.allocateIpBlock();
    try {
      const { tapIfCidr, tapIfIp, tapIfName, vmIp } = await this.networkService.setupInterfaces(
        ipBlockId,
      );
      const mask = new Netmask(`255.255.255.255/${tapIfCidr}`).mask;
      const ipArg = `${vmIp}::${tapIfIp}:${mask}::eth0:off:8.8.8.8`;

      this.logger.info("opening stdin");
      await execCmd("mkfifo", stdinPath);
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
      const childStdin = await fs.open(stdinPath, FifoFlags.O_NONBLOCK | FifoFlags.O_RDWR, "0600");
      const childStdout = await fs.open(logPath, "a");
      const childStderr = await fs.open(logPath, "a");
      let diskCtr = 1;
      const qemuExited = new AbortController();
      const cp = spawn(
        NS_PREFIX[0],
        [
          ...NS_PREFIX.slice(1),
          "qemu-system-x86_64",
          "-initrd",
          /* This tiny initrd allows us to mount all fs's at boot time and refer to disks by their serial number
           * Here is the code:
           * https://github.com/hocus-dev/tiny-initramfs/
           */
          "/srv/jailer/resources/initrd.img",
          "-qmp",
          `unix:${this.qmpSocketPath},server,nowait`,
          "-machine",
          "q35,acpi=off",
          "-m",
          `${config.memSizeMib}M`,
          ...mountOrder.flatMap(([path, what]) => {
            if ("mountPoint" in what) {
              throw new Error("virtiofs unsupported for now");
            }
            diskCtr += 1;
            return [
              "-blockdev",
              `node-name=q${diskCtr},driver=raw,file.driver=host_device,file.filename=${
                what.device
              },discard=unmap,detect-zeroes=unmap,file.aio=io_uring${
                what.readonly ? ",read-only=on" : ""
              }`,
              "-device",
              `virtio-blk,drive=q${diskCtr},discard=on,serial=${diskPathToVirtioId[path]}`,
            ];
          }),
          "--kernel",
          kernelPath,
          "--append",
          `reboot=k panic=-1 kernel.ctrlaltdel=0 nomodules random.trust_cpu=on i8042.noaux i8042.nomux i8042.nopnp i8042.dumbkbd ${
            /* Custom boot parameters are handled by the custom initrd */
            mountOrder
              .map(
                ([targetPath, what]) =>
                  `mountdevice=SERIAL=${
                    diskPathToVirtioId[targetPath]
                  } mounttarget=${targetPath} mountflags=${
                    what.readonly ? "ro" : "rw,discard"
                  } mountfstype=ext4`,
              )
              .join(" ")
          } ip=${ipArg} console=ttyS0 vm.compaction_proactiveness=100 vm.compact_unevictable_allowed=1 transparent_hugepage=never page_reporting.page_reporting_order=0 damon_reclaim.enabled=Y damon_reclaim.min_age=30000000 damon_reclaim.wmarks_low=0 damon_reclaim.wmarks_high=1000 damon_reclaim.wmarks_mid=999 damon_reclaim.quota_sz=1073741824 damon_reclaim.quota_reset_interval_ms=1000`,
          "-cpu",
          "host",
          "-smp",
          `${config.vcpuCount}`,
          "-nographic",
          "-enable-kvm",
          "-no-reboot",
          "-netdev",
          `tap,ifname=${tapIfName},script=no,downscript=no,vhost=off,id=n1`,
          "-device",
          "virtio-net-pci,netdev=n1",
          "-device",
          "virtio-balloon,deflate-on-oom=on,free-page-reporting=on",
        ],
        { stdio: [childStdin.fd, childStdout.fd, childStderr.fd], detached: true },
      );
      cp.unref();
      cp.on("error", (err) => {
        // Without this block the error is handled by the nodejs process itself and makes it
        // exit with code 1 crashing everything
        this.logger.error(`qemu process errored: ${displayError(err)}`);
        qemuExited.abort(err);
      });
      cp.on("close", (code) => {
        void childStdin.close();
        void childStdout.close();
        void childStderr.close();
        this.logger.info(`qemu process with pid ${cp.pid} closed: ${code}`);
        qemuExited.abort(new Error(`qemu process with pid ${cp.pid} closed: ${code}`));
      });

      if (cp.pid == null) {
        throw new Error(`[${this.instanceId}] Failed to start qemu`);
      }
      const runtimePid = cp.pid;
      vmStarted = true;
      await this.writeVmInfoFile({ pid: runtimePid, ipBlockId });
      this.logger.info(`[${this.instanceId}] Qemu process started with pid ${runtimePid}`);

      const sshConfig = { ...config.ssh, host: vmIp };
      return await Promise.race([
        new Promise<T>((_resolve, reject) => {
          if (qemuExited.signal.aborted) reject(qemuExited.signal.reason);
          qemuExited.signal.addEventListener("abort", () => reject(qemuExited.signal.reason), {
            once: true,
          });
        }),
        withSsh(
          sshConfig,
          this.logger,
          async (ssh) => {
            const t2 = performance.now();
            this.logger.info(`Booting qemu VM took: ${(t2 - t1).toFixed(2)} ms`);

            return await fn({
              ssh,
              sshConfig,
              runtimePid,
              vmIp,
              ipBlockId: unwrap(ipBlockId),
            });
          },
          qemuExited,
        ),
      ]);
    } finally {
      if (shouldPoweroff && vmStarted) {
        await this.shutdownVM();
      }
      if (shouldPoweroff && config.cleanupAfterStop) {
        await this.deleteVMDir();
      }
      // If we should poweroff or the vm was not started
      if ((shouldPoweroff || !vmStarted) && ipBlockId !== null) {
        await this.networkService.freeIpBlock(ipBlockId);
      }
    }
  }

  private async waitForQMPMessageWithTimeout(
    sock: Socket,
    timeoutMs = 500,
  ): Promise<unknown | undefined> {
    let timeout: NodeJS.Timeout | undefined;
    let timeoutDone = false;
    let timeoutResolve: ((value: unknown) => void) | undefined;
    const timeoutP = new Promise((resolve) => {
      timeoutResolve = resolve;
      timeout = setTimeout(() => {
        timeoutDone = true;
        this.logger.debug(`[${this.instanceId}] Timeout waiting for QMP message`);
        resolve(void 0);
      }, timeoutMs);
    });
    let msgResolve: ((value: unknown) => void) | undefined;
    const onceF = (c: Buffer) => {
      const msg = c.toString("utf8");
      if (msgResolve !== void 0) {
        this.logger.debug(`[${this.instanceId}] Received QMP message ${msg}`);
        msgResolve(JSON.parse(msg));
      } else {
        this.logger.error(`[${this.instanceId}] Logic error, missed QMP message ${msg}`);
      }
    };
    const r = await Promise.race([
      timeoutP,
      new Promise((resolve) => {
        msgResolve = resolve;
        sock.once("data", onceF);
      }),
    ]);
    // We hit the timeout first, we need to remove the listener to not leak memory .-.
    if (timeoutDone) {
      sock.removeListener("data", onceF);
    }
    // Cleanup the timeout promise if we got the message first
    if (!timeoutDone && timeoutResolve !== void 0) {
      clearTimeout(timeout);
      timeoutResolve(void 0);
      await timeoutP;
    }
    return r;
  }

  private async sendQMPMessage(sock: Socket, execute: string, args?: any) {
    const msg = JSON.stringify({
      execute,
      arguments: args,
    });
    this.logger.debug(`[${this.instanceId}] Sent QMP message ${msg}`);
    sock.write(msg);
  }

  private async qmpConnect(): Promise<Socket> {
    const sock = new Socket();
    await new Promise((resolve, reject) => {
      sock.on("error", (err) => reject(new QmpConnectionFailedError(err.message)));
      sock.connect(this.qmpSocketPath, () => resolve(void 0));
    });
    if ((await this.waitForQMPMessageWithTimeout(sock)) === void 0) {
      throw new QmpConnectionFailedError("Failed to connect to QMP");
    }
    await this.sendQMPMessage(sock, "qmp_capabilities");
    if ((await this.waitForQMPMessageWithTimeout(sock)) === void 0) {
      throw new QmpConnectionFailedError("Failed to get qmp capabilities");
    }
    return sock;
  }

  /**
   * Only works if the VM kernel is compiled with support for
   * `CONFIG_SERIO_I8042` and `CONFIG_KEYBOARD_ATKBD` as per
   * https://github.com/firecracker-microvm/firecracker/blob/2b8ad83629af511f918d616aa1c0d441e52c397a/docs/api_requests/actions.md#intel-and-amd-only-sendctrlaltdel
   *
   * Waits for the VM to shutdown.
   */
  private async shutdownVM(): Promise<void> {
    let sock: Socket;
    try {
      sock = await this.qmpConnect();
    } catch (err: any) {
      if (err instanceof QmpConnectionFailedError) return;
      throw err;
    }
    await this.sendQMPMessage(sock, "send-key", {
      keys: [
        { type: "qcode", data: "ctrl" },
        { type: "qcode", data: "alt" },
        { type: "qcode", data: "delete" },
      ],
    });
    if ((await this.waitForQMPMessageWithTimeout(sock)) === void 0) {
      throw new Error("Failed to press CTRL+ALT+DELETE");
    }
    // Now wait up to 5 seconds for a QMP event that the VM powered down
    let cleanShutdownDone = false;
    let t1 = performance.now();
    while (!cleanShutdownDone && performance.now() - t1 < 5000) {
      const m = await this.waitForQMPMessageWithTimeout(sock, 100);
      if (m !== void 0 && (m as any).event === "SHUTDOWN") {
        cleanShutdownDone = true;
      }
    }

    if (!cleanShutdownDone) {
      this.logger.error("Guest OS refused to shutdown gracefully within 5s. Killing the VM");
      // In case the VM does not cooperate ask qemu to exit forcefully
      await this.sendQMPMessage(sock, "quit");
      // We don't wait for a response cause we may get EOF in the middle of getting the response
    }
    sock.destroy();

    const vmInfo = await this.readVmInfoFile();
    if (vmInfo === null) return;
    // Give qemu 0.5s to terminate, if qemu failed to stop then send SIGKILL
    let t2 = performance.now();
    while (
      (await doesFileExist(path.join("/proc", vmInfo.pid.toString()))) &&
      performance.now() - t2 < 500
    ) {
      await sleep(100);
    }

    if (await doesFileExist(path.join("/proc", vmInfo.pid.toString()))) {
      this.logger.error("Qemu refused to terminate gracefully for 0.5s. Killing Qemu");
      await process.kill(vmInfo.pid, "SIGKILL");
    }

    // Give the kernel 0.5s to cleanup the process
    let t3 = performance.now();
    while (
      (await doesFileExist(path.join("/proc", vmInfo.pid.toString()))) &&
      performance.now() - t3 < 500
    ) {
      await sleep(100);
    }

    if (await doesFileExist(path.join("/proc", vmInfo.pid.toString()))) {
      this.logger.error(
        "Kernel failed to cleanup qemu for 0.5s after SIGKILL. Process probably hanged in kernel space!",
      );
      throw new Error(`[${this.instanceId}] Qemu hanged in kernel space`);
    }
  }

  private async deleteVMDir(): Promise<void> {
    await fs.rm(this.instanceDir, { recursive: true, force: true });
  }

  /** Stops the VM and cleans up its resources. Idempotent. */
  async cleanup(): Promise<void> {
    const vmInfo = await this.getRuntimeInfo();
    if (vmInfo?.status === "on") {
      await this.shutdownVM();
    }
    if (vmInfo != null) {
      await this.networkService.freeIpBlock(vmInfo.info.ipBlockId as IpBlockId);
    }
    await this.deleteVMDir();
  }
}
