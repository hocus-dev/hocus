import { DefaultLogger } from "@temporalio/worker";

import { FirecrackerService } from "./firecracker.service";

/**
 * Returns the pid of the firecracker process.
 */
export const startVM = async (args: {
  instanceId: string;
  kernelPath: string;
  rootFsPath: string;
  drives: Parameters<FirecrackerService["createVM"]>[0]["extraDrives"];
}): Promise<void> => {
  const logger = new DefaultLogger();
  const socketPath = `/tmp/${args.instanceId}.sock`;
  const fc = new FirecrackerService(socketPath);

  await fc.startFirecrackerInstance(`/tmp/${args.instanceId}`);
  logger.info("firecracker process started");

  const vmIp = "168.254.0.21";
  const tapDeviceIp = "168.254.0.22";
  const tapDeviceCidr = 24;
  const tapDeviceName = "hocus-tap-0";
  fc.setupNetworking({
    vmIp,
    tapDeviceName,
    tapDeviceIp,
    tapDeviceCidr,
  });
  logger.info("networking set up");

  await fc.createVM({
    kernelPath: args.kernelPath,
    rootFsPath: args.rootFsPath,
    vmIp,
    tapDeviceIp,
    tapDeviceName,
    tapDeviceCidr,
    extraDrives: args.drives,
  });
  logger.info("vm created");
};
