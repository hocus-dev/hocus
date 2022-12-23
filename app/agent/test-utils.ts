import type { NodeSSH } from "node-ssh";
import type { Config } from "~/config";

import type { FirecrackerService } from "./firecracker.service";

export const withTestMount = async <T>(
  fcService: FirecrackerService,
  drivePath: string,
  agentConfig: ReturnType<Config["agent"]>,
  fn: (ssh: NodeSSH, mountPath: string) => Promise<T>,
): Promise<T> => {
  const mountPath = "/mnt/drive";
  return await fcService.withVM(
    {
      ssh: {
        username: "hocus",
        password: "hocus",
      },
      kernelPath: agentConfig.defaultKernel,
      rootFsPath: agentConfig.fetchRepositoryRootFs,
      extraDrives: [
        {
          pathOnHost: drivePath,
          guestMountPath: mountPath,
        },
      ],
    },
    async ({ ssh }) => {
      return await fn(ssh, mountPath);
    },
  );
};
