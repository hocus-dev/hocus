import { DefaultLogger } from "@temporalio/worker";

import { FirecrackerService } from "./firecracker.service";

/**
 * Returns the pid of the firecracker process.
 */
export const startFirecrackerInstance = async (instanceId: string): Promise<void> => {
  const logger = new DefaultLogger();
  const socketPath = `/tmp/${instanceId}.sock`;
  const fc = new FirecrackerService(socketPath);

  await fc.startFirecrackerInstance(`/tmp/${instanceId}`);
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
    kernelPath: "/hocus-resources/vmlinux-5.6-x86_64.bin",
    fsPath: "/hocus-resources/hocus.ext4",
    vmIp,
    tapDeviceIp,
    tapDeviceName,
    tapDeviceCidr,
  });
  logger.info("vm created");
};
