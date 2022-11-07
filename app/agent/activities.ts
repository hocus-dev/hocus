import fs from "fs";

import { Token } from "~/token";

import { createAgentInjector } from "./agent-injector";
import { createExt4Image, execSshCmd } from "./utils";

export const createActivities = async () => {
  const injector = createAgentInjector();

  const fetchRepository = async (args: {
    instanceId: string;
    kernelPath: string;
    rootFsPath: string;
    outputDrive: {
      pathOnHost: string;
      maxSizeMiB: number;
    };
    resourcesDir: string;
    repositoryUrl: string;
  }): Promise<void> => {
    const logger = injector.resolve(Token.Logger);
    const firecrackerService = injector.resolve(Token.FirecrackerService)(args.instanceId);

    const outputDriveExists = fs.existsSync(args.outputDrive.pathOnHost);
    if (!outputDriveExists) {
      createExt4Image(args.outputDrive.pathOnHost, args.outputDrive.maxSizeMiB);
      logger.info(`empty output image created at ${args.outputDrive.pathOnHost}`);
    }
    await firecrackerService.withVM(
      {
        ssh: {
          username: "hocus",
          password: "hocus",
        },
        kernelPath: args.kernelPath,
        rootFsPath: args.rootFsPath,
        extraDrives: [args.outputDrive.pathOnHost],
      },
      async ({ ssh }) => {
        const outputDir = "/tmp/output";
        const repositoryDir = "/tmp/output/repo";
        const logFilePath = "/tmp/ssh-fetchrepo.log";
        await execSshCmd({ ssh }, ["sudo", "mkdir", "-p", outputDir]);
        await execSshCmd({ ssh }, ["sudo", "mount", "/dev/vdb", outputDir]);
        if (!outputDriveExists) {
          await execSshCmd({ ssh }, ["sudo", "chown", "-R", "hocus:hocus", outputDir]);
        }

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
            "--no-checkout",
            args.repositoryUrl,
            repositoryDir,
          ]);
        }
      },
    );
  };

  const buildfs = async (args: {
    instanceId: string;
    rootFsPath: string;
    kernelPath: string;
    outputDrive: {
      pathOnHost: string;
      maxSizeMiB: number;
    };
    resourcesDir: string;
    /**
     * The relative path to the Dockerfile in the resources directory.
     */
    pathToDockerfile: string;
  }): Promise<void> => {
    const firecrackerService = injector.resolve(Token.FirecrackerService)(args.instanceId);

    createExt4Image(args.outputDrive.pathOnHost, args.outputDrive.maxSizeMiB, true);

    await firecrackerService.withVM(
      {
        ssh: {
          username: "root",
          password: "root",
        },
        kernelPath: args.kernelPath,
        rootFsPath: args.rootFsPath,
        extraDrives: [args.outputDrive.pathOnHost],
      },
      async ({ ssh }) => {
        const workdir = "/tmp/workdir";
        const outputDir = "/tmp/output";
        const buildfsScriptPath = `${workdir}/bin/buildfs.sh`;
        await execSshCmd({ ssh }, ["rm", "-rf", workdir]);
        await execSshCmd({ ssh }, ["mkdir", "-p", workdir]);
        await execSshCmd({ ssh }, ["mkdir", "-p", outputDir]);
        await execSshCmd({ ssh }, ["mount", "/dev/vdb", outputDir]);
        await ssh.putDirectory(args.resourcesDir, workdir);
        await execSshCmd({ ssh }, ["chmod", "+x", buildfsScriptPath]);
        await execSshCmd(
          { ssh, logFilePath: `/tmp/buildfs-${args.instanceId}.log`, opts: { cwd: workdir } },
          [buildfsScriptPath, `${workdir}/${args.pathToDockerfile}`, outputDir, workdir],
        );
      },
    );
  };

  return {
    fetchRepository,
    buildfs,
  };
};

// /**
//  * Returns the pid of the firecracker process.
//  */
// export const startVM = async (args: {
//   instanceId: string;
//   kernelPath: string;
//   rootFsPath: string;
//   drives: Parameters<FirecrackerService["createVM"]>[0]["extraDrives"];
// }): Promise<void> => {
//   const logger = new DefaultLogger();
//   const socketPath = `/tmp/${args.instanceId}.sock`;
//   const fc = new FirecrackerService(socketPath);

//   await fc.startFirecrackerInstance(`/tmp/${args.instanceId}`);
//   logger.info("firecracker process started");

//   const vmIp = "168.254.0.21";
//   const tapDeviceIp = "168.254.0.22";
//   const tapDeviceCidr = 24;
//   const tapDeviceName = "hocus-tap-0";
//   fc.setupNetworking({
//     tapDeviceName,
//     tapDeviceIp,
//     tapDeviceCidr,
//   });
//   logger.info("networking set up");

//   await fc.createVM({
//     kernelPath: args.kernelPath,
//     rootFsPath: args.rootFsPath,
//     vmIp,
//     tapDeviceIp,
//     tapDeviceName,
//     tapDeviceCidr,
//     extraDrives: args.drives,
//   });
//   logger.info("vm created");
// };
