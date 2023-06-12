import type { Config as SSHConfig, NodeSSH } from "node-ssh";

import type { IpBlockId } from "../network/workspace-network.service";

import type { VmInfo } from "./vm-info.validator";

type FsSpec = { device: string; readonly: boolean } | { mountPoint: string; readonly: boolean };

export interface HocusRuntime {
  getRuntimeInfo(): Promise<{ status: "on" | "off" | "paused"; info: VmInfo } | null>;
  withRuntime<T>(
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
      fs: {
        "/": FsSpec;
      } & Record<string, FsSpec>;
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
  ): Promise<T>;
  cleanup(): Promise<void>;
}
