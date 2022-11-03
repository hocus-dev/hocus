import fs from "fs";

import { DefaultLogger } from "@temporalio/worker";

import { FirecrackerService } from "./firecracker.service";
import { createExt4Image, execSshCmd, watchFileUntilLineMatches, withSsh } from "./utils";

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
  resourcesDir: string;
}): Promise<void> => {
  const logger = new DefaultLogger();
  const socketPath = `/tmp/${args.instanceId}.sock`;
  const fc = new FirecrackerService(socketPath);

  const fcPid = await fc.startFirecrackerInstance(`/tmp/${args.instanceId}`);
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
  try {
    await withSsh(
      {
        host: vmIp,
        username: "root",
        password: "root",
      },
      async (ssh) => {
        const workdir = "/tmp/workdir";
        const outputDir = "/tmp/output";
        const buildfsScriptPath = `${workdir}/bin/buildfs.sh`;
        await execSshCmd({ ssh }, ["rm", "-rf", workdir]);
        await execSshCmd({ ssh }, ["mkdir", "-p", workdir]);
        await execSshCmd({ ssh }, ["mkdir", "-p", outputDir]);
        await execSshCmd({ ssh }, ["mount", "/dev/vdb", outputDir]);
        await ssh.putDirectory(args.resourcesDir, workdir);
        await execSshCmd({ ssh }, ["chmod", "+x", buildfsScriptPath]);
        await execSshCmd({ ssh, logFilePath: "/tmp/hocus-buildfs.log", opts: { cwd: workdir } }, [
          buildfsScriptPath,
          `${workdir}/docker/buildfs.Dockerfile`,
          outputDir,
          workdir,
          "2500",
        ]);

        await execSshCmd({ ssh, allowNonZeroExitCode: true }, ["poweroff"]);
        logger.info(`ssh finished`);
        await watchFileUntilLineMatches(
          /reboot: System halted/,
          `/tmp/${args.instanceId}.log`,
          10000,
        );
        logger.info(`vm shutdown finished`);
      },
    );
  } finally {
    process.kill(fcPid);
  }
};

export const fetchRepository = async (args: {
  instanceId: string;
  rootFsPath: string;
  kernelPath: string;
  outputDrive: {
    pathOnHost: string;
    sizeMiB: number;
  };
  resourcesDir: string;
  repositoryUrl: string;
}): Promise<void> => {
  const logger = new DefaultLogger();
  const socketPath = `/tmp/${args.instanceId}.sock`;
  const fc = new FirecrackerService(socketPath);

  const fcPid = await fc.startFirecrackerInstance(`/tmp/${args.instanceId}`);
  logger.info("firecracker process started");

  const vmIp = "168.254.2.21";
  const tapDeviceIp = "168.254.2.22";
  const tapDeviceCidr = 24;
  const tapDeviceName = "hocus-tap-2";
  fc.setupNetworking({
    tapDeviceName,
    tapDeviceIp,
    tapDeviceCidr,
  });
  logger.info("networking set up");

  if (!fs.existsSync(args.outputDrive.pathOnHost)) {
    createExt4Image(args.outputDrive.pathOnHost, args.outputDrive.sizeMiB);
    logger.info(`empty output image created at ${args.outputDrive.pathOnHost}`);
  }

  await fc.createVM({
    kernelPath: args.kernelPath,
    rootFsPath: args.rootFsPath,
    vmIp,
    tapDeviceIp,
    tapDeviceName,
    tapDeviceCidr,
    extraDrives: [
      {
        driveId: "repository",
        pathOnHost: args.outputDrive.pathOnHost,
        isReadOnly: false,
        isRootDevice: false,
      },
    ],
  });
  logger.info("vm created");
  try {
    await withSsh(
      {
        host: vmIp,
        username: "root",
        password: "root",
      },
      async (ssh) => {
        const outputDir = "/tmp/output";
        const repositoryDir = "/tmp/output/repo";
        const logFilePath = "/tmp/ssh-fetchrepo.log";
        await execSshCmd({ ssh }, ["mkdir", "-p", repositoryDir]);
        await execSshCmd({ ssh }, ["mount", "/dev/vdb", outputDir]);

        const repositoryExists =
          (
            await execSshCmd({ ssh, allowNonZeroExitCode: true }, [
              "test",
              "-d",
              `${repositoryDir}/.git`,
            ])
          ).code === 0;
        if (repositoryExists) {
          await execSshCmd({ ssh, logFilePath, opts: { cwd: repositoryDir } }, [
            "git",
            "fetch",
            "--all",
          ]);
        } else {
          await execSshCmd({ ssh, logFilePath }, [
            "git",
            "clone",
            args.repositoryUrl,
            repositoryDir,
          ]);
        }

        await execSshCmd({ ssh, allowNonZeroExitCode: true }, ["poweroff"]);
        logger.info(`ssh finished`);
        await watchFileUntilLineMatches(
          /reboot: System halted/,
          `/tmp/${args.instanceId}.log`,
          10000,
        );
        logger.info(`vm shutdown finished`);
      },
    );
  } finally {
    process.kill(fcPid);
  }
};
