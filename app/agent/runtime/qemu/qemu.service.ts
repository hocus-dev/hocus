// cSpell: words nomodules mountdevice proactiveness noaux nomux nopnp dumbkbd unevictable ifname downscript hugepage mounttarget mountflags mountfstype wmarks SERIO ATKBD qcode blockdev ctrlaltdel
import { spawn } from "child_process";
import fs from "fs/promises";
import type { SocketConstructorOpts } from "net";
import { Socket } from "net";
import path from "path";
import { EventEmitter } from "stream";

import type { DefaultLogger } from "@temporalio/worker";
import { Netmask } from "netmask";
import type { Config as SSHConfig, NodeSSH } from "node-ssh";
import { match } from "ts-pattern";

import { MAX_UNIX_SOCKET_PATH_LENGTH } from "../../constants";
import { FifoFlags } from "../../fifo-flags";
import { execCmd, execSshCmd, isProcessAlive, withSsh } from "../../utils";
import type { HocusRuntime } from "../hocus-runtime";
import type { VmInfo } from "../vm-info.validator";
import { VmInfoValidator } from "../vm-info.validator";

import type { IpBlockId, WorkspaceNetworkService } from "~/agent/network/workspace-network.service";
import { NS_PREFIX } from "~/agent/network/workspace-network.service";
import type { Config } from "~/config";
import { Token } from "~/token";
import { doesFileExist } from "~/utils.server";
import { displayError, sleep, unwrap, waitForPromises } from "~/utils.shared";

export class QmpConnectionFailedError extends Error {}

export class QMPSocket extends EventEmitter {
  private _sock: Socket;
  // If null then does not process any inflight request
  private cmdInflight: [(v: any) => void, (err: any) => void] | null;
  constructor(
    private readonly instanceId: string,
    private readonly logger: DefaultLogger,
    opts?: SocketConstructorOpts,
  ) {
    super();
    this._sock = new Socket(opts);
    this.cmdInflight = null;
  }

  async connect(qmpSocketPath: string): Promise<void> {
    this.logger.debug(`[${this.instanceId}] Connecting to qmp socket`);
    await new Promise((resolve, reject) => {
      const socketErrHandler = (err: any) => reject(new QmpConnectionFailedError(err.message));
      this._sock.on("error", socketErrHandler);
      this._sock.connect(qmpSocketPath, () => {
        this.logger.debug(`[${this.instanceId}] Connected to qmp socket`);
        this._sock.removeListener("error", socketErrHandler);
        resolve(void 0);
      });
    });
    // Ok we're connected, time to set up event handlers
    this._sock.on("error", (err) => {
      if (this.cmdInflight) {
        const reject = this.cmdInflight[1];
        this.cmdInflight = null;
        reject(err);
      } else {
        this.emit("error", err);
      }
    });
    this._sock.on("data", (c: Buffer) => {
      const msgs = c.toString("utf8");
      this.logger.debug(`[${this.instanceId}] Received QMP message ${msgs}`);
      for (const msg of msgs.split("\n")) {
        if (msg.trim().length === 0) continue;
        let parsed: any;
        try {
          parsed = JSON.parse(msg);
          if ("event" in parsed) {
            // Emit QMP events
            if (!this.emit(parsed.event.toLowerCase(), parsed)) {
              this.logger.error(`[${this.instanceId}] No listeners for QMP event ${msg}`);
            }
          } else {
            if (this.cmdInflight) {
              const cb = this.cmdInflight[0];
              this.cmdInflight = null;
              cb(parsed);
            } else {
              this.logger.error(`[${this.instanceId}] Logic error, missed QMP response ${msg}`);
            }
          }
        } catch (e) {
          this.logger.error(`[${this.instanceId}] Failed to parse QMP message: ${msg}`);
          this.emit("error", e);
        }
      }
    });

    if ((await this.waitForQmpResponseWithTimeout()) === void 0) {
      throw new QmpConnectionFailedError("Failed to connect to QMP");
    }
    if ((await this.executeQMPCommandWaitForResponse("qmp_capabilities")) === void 0) {
      throw new QmpConnectionFailedError("Failed to get qmp capabilities");
    }
  }

  async executeQMPCommandWaitForResponse(
    execute: string,
    args?: any,
    timeoutMs = 500,
  ): Promise<any> {
    const msg = JSON.stringify({
      execute,
      arguments: args,
    });
    this.logger.debug(`[${this.instanceId}] Sent QMP command ${msg}`);
    this._sock.write(msg);
    return await this.waitForQmpResponseWithTimeout(timeoutMs);
  }

  async executeQMPCommandAndShutdown(execute: string, args?: any): Promise<void> {
    const msg = JSON.stringify({
      execute,
      arguments: args,
    });
    this.logger.debug(`[${this.instanceId}] Sent QMP command ${msg}`);
    this._sock.write(msg);
    this.disconnect();
  }

  private async waitForQmpResponseWithTimeout(timeoutMs = 500): Promise<unknown | undefined> {
    let timeout: NodeJS.Timeout | undefined;
    let timeoutDone = false;
    let timeoutResolve: ((value: unknown) => void) | undefined;
    const timeoutP = new Promise((resolve) => {
      timeoutResolve = resolve;
      timeout = setTimeout(() => {
        timeoutDone = true;
        this.logger.debug(`[${this.instanceId}] Timeout waiting for QMP response`);
        resolve(void 0);
      }, timeoutMs);
    });

    const r = await Promise.race([
      timeoutP,
      new Promise((resolve, reject) => {
        this.cmdInflight = [resolve, reject];
      }),
    ]);
    // Cleanup the timeout promise if we got the message first
    if (!timeoutDone && timeoutResolve !== void 0) {
      clearTimeout(timeout);
      timeoutResolve(void 0);
      await timeoutP;
    }
    return r;
  }

  disconnect(): void {
    this._sock.destroy();
    this._sock.removeAllListeners();
    this.removeAllListeners();
    if (this.cmdInflight) {
      const reject = this.cmdInflight[1];
      this.cmdInflight = null;
      reject(new Error("Disconnected while waiting for qmp response"));
    }
  }
}

const CHROOT_PATH_TO_SOCK = "/run/sock";
// https://github.com/torvalds/linux/blob/8b817fded42d8fe3a0eb47b1149d907851a3c942/include/uapi/linux/virtio_blk.h#L58
const VIRTIO_BLK_ID_BYTES = 20;

export function factoryQemuService(
  logger: DefaultLogger,
  config: Config,
  networkService: WorkspaceNetworkService,
): (instanceId: string) => HocusRuntime {
  return (instanceId: string) => new QemuService(logger, config, networkService, instanceId);
}
factoryQemuService.inject = [Token.Logger, Token.Config, Token.WorkspaceNetworkService] as const;

export class QemuService implements HocusRuntime {
  private readonly qmpSocketPath: string;
  private readonly instanceDir: string;
  private readonly instanceDirRoot: string;
  private readonly vmInfoFilePath: string;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(
    private readonly logger: DefaultLogger,
    config: Config,
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

    const qmpSock = new QMPSocket(this.instanceId, this.logger);
    try {
      await qmpSock.connect(this.qmpSocketPath);
    } catch (err: any) {
      if (err instanceof QmpConnectionFailedError) return null;
      throw err;
    }

    const m = await qmpSock.executeQMPCommandWaitForResponse("query-status");
    if (m === void 0) {
      return null;
    }
    qmpSock.disconnect();
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
        .otherwise((v) => {
          throw new Error(`Unknown vm state: ${v}`);
        }),
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
    // We need to ensure that we mount devices from the top down,
    // If /asf would be mounted before / then the /asf mount wouldn't be
    // the parent of the / mount, breaking the system.
    // We only care to sort the mount targets from top down
    // This logic was omitted from the initrd because it's easier to do it here
    const mountOrder = Object.entries(config.fs).sort(
      ([pathA, _a], [pathB, _b]) => pathA.split("/").length - pathB.split("/").length,
    );
    const diskPathToVirtioId: Record<string, string> = {};
    // This allows us to directly move the current code to cloud hypervisor if we ever need it
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
      // The pipe is opened with O_RDWR even though the qemu process only reads from it.
      // This is because of how FIFOs work in linux - when the last writer closes the pipe,
      // the reader gets an EOF. When the VM receives an EOF on the stdin, it detaches
      // serial input, and we can no longer interact with its console. If we opened this pipe
      // as read only and later opened it again as a writer to run some commands, once we stopped
      // writing to it, the VM would receive an EOF and detach the serial input, making it impossible
      // to make any more writes. Since we open it as read/write here, there is always a writer and
      // the VM never receives an EOF.
      //
      // Learned how to open a FIFO here: https://github.com/firecracker-microvm/firecracker-go-sdk/blob/9a0d3b28f7f7ae1ac96e970dec4d28a09f10c4a9/machine.go#L742
      // Learned about read/write/EOF behavior here: https://stackoverflow.com/a/40390938
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
          `systemd.firstboot=off reboot=k panic=-1 kernel.ctrlaltdel=0 nomodules random.trust_cpu=on i8042.noaux i8042.nomux i8042.nopnp i8042.dumbkbd ${
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

            const r = await fn({
              ssh,
              sshConfig,
              runtimePid,
              vmIp,
              ipBlockId: unwrap(ipBlockId),
            });

            // Ensure the page cache is flushed before proceeding
            await execSshCmd({ ssh }, ["sync"]);

            return r;
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

  /**
   * Only works if the VM kernel is compiled with support for
   * `CONFIG_SERIO_I8042` and `CONFIG_KEYBOARD_ATKBD` as per
   * https://github.com/firecracker-microvm/firecracker/blob/2b8ad83629af511f918d616aa1c0d441e52c397a/docs/api_requests/actions.md#intel-and-amd-only-sendctrlaltdel
   *
   * Waits for the VM to shut down.
   */
  private async shutdownVM(): Promise<void> {
    for (let retry = 0; retry < 2; retry += 1) {
      const qmpSock = new QMPSocket(this.instanceId, this.logger);
      try {
        let cleanShutdownDone = false;
        qmpSock.on("shutdown", () => {
          cleanShutdownDone = true;
        });
        try {
          await qmpSock.connect(this.qmpSocketPath);
        } catch (err: any) {
          if (err instanceof QmpConnectionFailedError) return;
          throw err;
        }
        if (
          (await qmpSock.executeQMPCommandWaitForResponse(
            "send-key",
            {
              keys: [
                { type: "qcode", data: "ctrl" },
                { type: "qcode", data: "alt" },
                { type: "qcode", data: "delete" },
              ],
            },
            1000,
          )) === void 0
        ) {
          throw new Error("Failed to press CTRL+ALT+DELETE");
        }
        // Now wait up to 5 seconds for a QMP event that the VM powered down
        let t1 = performance.now();
        while (!cleanShutdownDone && performance.now() - t1 < 5000) {
          await sleep(100);
        }

        if (!cleanShutdownDone) {
          this.logger.error("Guest OS refused to shutdown gracefully within 5s. Killing the VM");
          // In case the VM does not cooperate ask qemu to exit forcefully
          qmpSock.on("error", () => void 0);
          await qmpSock.executeQMPCommandAndShutdown("quit");
        }
        break;
      } catch (err: any) {
        this.logger.error(
          `[${
            this.instanceId
          }] Got error while trying to shutdown the VM gracefully: ${JSON.stringify(err)}`,
        );
        // In case qemu shuts down while interacting with the qmp socket
        if (
          !(
            (err?.message && err?.message.includes("EPIPE")) ||
            (err?.message && err?.message.includes("ECONNRESET")) ||
            (err?.code && err?.code.includes("EPIPE")) ||
            (err?.code && err?.code.includes("ECONNRESET")) ||
            (err?.message && err?.message.includes("Failed to press"))
          )
        ) {
          throw err;
        }
      } finally {
        qmpSock.disconnect();
      }
      this.logger.error(`${this.instanceId} Retrying shutdown logic`);
    }

    const vmInfo = await this.readVmInfoFile();
    if (vmInfo === null) return;
    // Give qemu 0.5s to terminate, if qemu failed to stop then send SIGKILL
    let t2 = performance.now();
    while ((await isProcessAlive(vmInfo.pid)) && performance.now() - t2 < 500) {
      await sleep(100);
    }

    if (await isProcessAlive(vmInfo.pid)) {
      this.logger.error("Qemu refused to terminate gracefully for 0.5s. Killing Qemu");
      process.kill(vmInfo.pid, "SIGKILL");
    }

    // Give the kernel 0.5s to clean up the process
    let t3 = performance.now();
    while ((await isProcessAlive(vmInfo.pid)) && performance.now() - t3 < 500) {
      await sleep(100);
    }

    if (await isProcessAlive(vmInfo.pid)) {
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
