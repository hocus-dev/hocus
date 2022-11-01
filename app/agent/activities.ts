import fs from "fs";

import { DefaultLogger } from "@temporalio/worker";

import { FirecrackerService } from "./firecracker.service";
import { createExt4Image, watchFileUntilLineMatches, withSsh } from "./utils";

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

export const buildfs = async (args: {
  instanceId: string;
  rootFsPath: string;
  kernelPath: string;
  outputDrive: {
    pathOnHost: string;
    sizeMiB: number;
  };
}): Promise<void> => {
  const logger = new DefaultLogger();
  const socketPath = `/tmp/${args.instanceId}.sock`;
  const fc = new FirecrackerService(socketPath);

  await fc.startFirecrackerInstance(`/tmp/${args.instanceId}`);
  logger.info("firecracker process started");

  const vmIp = "168.254.1.21";
  const tapDeviceIp = "168.254.1.22";
  const tapDeviceCidr = 24;
  const tapDeviceName = "hocus-tap-1";
  fc.setupNetworking({
    tapDeviceName,
    tapDeviceIp,
    tapDeviceCidr,
  });
  logger.info("networking set up");

  createExt4Image(args.outputDrive.pathOnHost, args.outputDrive.sizeMiB, true);
  logger.info(`empty output image created at ${args.outputDrive.pathOnHost}`);

  await fc.createVM({
    kernelPath: args.kernelPath,
    rootFsPath: args.rootFsPath,
    vmIp,
    tapDeviceIp,
    tapDeviceName,
    tapDeviceCidr,
    extraDrives: [
      {
        driveId: "output",
        pathOnHost: args.outputDrive.pathOnHost,
        isReadOnly: false,
        isRootDevice: false,
      },
    ],
  });
  logger.info("vm created");
  await withSsh(
    {
      host: vmIp,
      username: "root",
      password: "root",
    },
    async (ssh) => {
      const logfilePath = `/tmp/${args.instanceId}-buildfs-ssh.log`;
      const logFile = fs.openSync(logfilePath, "w");
      try {
        await ssh.exec("poweroff", [], {
          onStdout: (chunk) => fs.writeSync(logFile, chunk),
          onStderr: (chunk) => fs.writeSync(logFile, chunk),
        });
      } finally {
        fs.closeSync(logFile);
      }
      logger.info(`ssh finished`);
      await watchFileUntilLineMatches(
        /reboot: System halted/,
        `/tmp/${args.instanceId}.log`,
        10000,
      );
      logger.info(`vm shutdown finished`);
    },
  );
};
