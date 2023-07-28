import { mkdir } from "fs/promises";
import { join } from "path";

import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "~/agent/agent-injector";
import { ContainerId, ImageId } from "~/agent/block-registry/registry.service";
import { execCmd, execSshCmd, withRuntimeAndImages, withSsh } from "~/agent/utils";
import { Token } from "~/token";
import { runOnTimeout } from "~/utils.server";

async function run() {
  const injector = createAgentInjector();
  const agentConfig = injector.resolve(Token.Config).agent();
  const brService = injector.resolve(Token.BlockRegistryService);
  const qemuService = injector.resolve(Token.QemuService);
  const blockRegistryRoot = agentConfig.blockRegistryRoot;

  await brService.initializeRegistry();
  const [overlaybdProcess, overlaybdProcessPromise] = await brService.startOverlaybdProcess({
    logFilePath: join(blockRegistryRoot, "logs", "overlaybd-process.log"),
  });
  await (async () => {
    const qcow2Path = join(agentConfig.blockRegistryRoot, "qcow2");
    await mkdir(qcow2Path).catch(() => void 0);

    const rootfsImage = await brService.loadImageFromRemoteRepo(
      agentConfig.checkoutAndInspectImageTag,
      uuidv4(),
    );
    const rootfsContainer = await brService.createContainer(rootfsImage, uuidv4());
    let prevQcow2: string | undefined = void 0;
    let prevObd: ImageId | undefined = void 0;

    for (let i = 0; i < 2; i += 1) {
      const curQcow2 = join(qcow2Path, uuidv4());
      const curObd: ContainerId = await brService.createContainer(prevObd, uuidv4(), {
        mkfs: prevObd === void 0,
        sizeInGB: 64,
      });
      if (prevQcow2 !== void 0) {
        console.log(
          await execCmd(
            ...["qemu-img", "create", "-F", "qcow2", "-b", prevQcow2, "-f", "qcow2", curQcow2],
          ),
        );
      } else {
        // First image
        await execCmd(...["truncate", "-s", "64G", curQcow2 + ".raw"]);
        await execCmd(...["mkfs.ext4", curQcow2 + ".raw"]);
        await execCmd(
          ...["qemu-img", "convert", "-f", "raw", "-O", "qcow2", curQcow2 + ".raw", curQcow2],
        );
      }

      await withRuntimeAndImages(
        brService,
        qemuService(uuidv4()),
        {
          cleanupAfterStop: true,
          shouldPoweroff: true,
          ssh: {
            username: "hocus",
            password: "hocus",
          },
          fs: {
            "/": rootfsContainer,
            "/benchmark": { qcow2: curQcow2 },
          },
          memSizeMib: 1024,
          vcpuCount: 2,
        },
        async ({ ssh }) => {
          if (i === 0) {
            await execSshCmd({ ssh }, ["sudo", "sh", "-c", "apk add hyperfine"]);
          }
          console.log(
            await execSshCmd({ ssh }, [
              "sudo",
              "sh",
              "-c",
              "dd if=/dev/urandom bs=1M count=10 >> /benchmark/file",
            ]),
            await execSshCmd({ ssh }, ["sudo", "sh", "-c", "ls -lha /benchmark/file"]),
            await execSshCmd({ ssh }, [
              "sudo",
              "sh",
              "-c",
              "hyperfine --runs 10 --prepare 'sync; echo 3 > /proc/sys/vm/drop_caches' 'sha256sum /benchmark/file'",
            ]),
          );
        },
      );
      prevQcow2 = curQcow2;
      prevObd = await brService.commitContainer(curObd, uuidv4());
    }
  })()
    .finally(brService.hideEverything.bind(brService))
    .finally(async () => {
      overlaybdProcess.kill("SIGINT");
      await runOnTimeout({ waitFor: overlaybdProcessPromise, timeoutMs: 1000 }, () => {
        overlaybdProcess.kill("SIGKILL");
      });
    });
}

let returnCode = 0;
run()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    returnCode = 1;
  })
  .finally(async () => {
    if (returnCode != 0) {
      process.exit(returnCode);
    }
  });
