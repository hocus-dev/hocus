/* eslint-disable no-console */
import type { ChildProcessWithoutNullStreams } from "child_process";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { formatWithOptions } from "util";

import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "../agent-injector";
import { execCmd, ExecCmdError, execCmdWithOpts } from "../utils";

import type { BlockRegistryService } from "./registry.service";

import { config as defaultConfig } from "~/config";
import { Scope } from "~/di/injector.server";
import { printErrors } from "~/test-utils";
import { Token } from "~/token";
import { sleep } from "~/utils.shared";

export const provideBlockRegistry = (
  testFn: (args: {
    injector: ReturnType<typeof createAgentInjector>;
    brService: BlockRegistryService;
    runId: string;
  }) => Promise<void>,
  opts: {
    skipInit: boolean;
  } = {
    skipInit: false,
  },
): (() => Promise<void>) => {
  const runId = uuidv4();
  const testsDir = "/srv/jailer/tests/";
  const testRunDir = path.join(testsDir, runId);
  const blockRegistryRoot = path.join(testRunDir, "block-registry");
  const injector = createAgentInjector({
    [Token.Logger]: {
      provide: {
        factory: function () {
          const format = formatWithOptions.bind(undefined, { colors: true });
          return new DefaultLogger("ERROR", (entry) => {
            entry.meta = entry.meta === void 0 ? {} : entry.meta;
            entry.meta["runId"] = runId;
            const { level, timestampNanos, message, meta } = entry;
            const date = new Date(Number(timestampNanos / 1000000n));
            process.stderr.write(`${format(date)} [${level}] [${format(meta)}] ${message} \n`);
          });
        },
      },
      scope: Scope.Transient,
    },
    [Token.Config]: {
      provide: {
        value: {
          ...defaultConfig,
          agent: () => ({ ...defaultConfig.agent(), blockRegistryRoot }),
        },
      },
    },
  });
  let shouldTerminate = false;
  let tcmuSubprocess: [ChildProcessWithoutNullStreams, Promise<void>] | undefined = void 0;
  let tcmuStdout = "";
  let tcmuStderr = "";
  let keepStorage = false;
  return printErrors(async () => {
    if (!opts.skipInit) {
      await fs.mkdir(testRunDir, { recursive: true });
    }
    const brService = injector.resolve(Token.BlockRegistryService);
    try {
      let cpWait: Promise<void>;
      if (!opts.skipInit) {
        await brService.initializeRegistry();
        const cp = spawn("/opt/overlaybd/bin/overlaybd-tcmu", [
          path.join(blockRegistryRoot, "overlaybd.json"),
        ]);
        cpWait = new Promise<void>((resolve, reject) => {
          cp.stdout.on("data", (data) => {
            tcmuStdout += data;
          });
          cp.stderr.on("data", (data) => {
            tcmuStderr += data;
          });
          cp.on("error", reject);
          cp.on("close", (code) => {
            if (!shouldTerminate) {
              console.error(`[${runId}] overlaybd-tcmu exited prematurely with code ${code}`);
              console.error(`[${runId}] overlaybd-tcmu STDOUT: ${tcmuStdout}`);
              console.error(`[${runId}] overlaybd-tcmu STDERR: ${tcmuStderr}`);
              console.error(`[${runId}] Please consult the artifacts for more details`);
              reject("overlaybd-tcmu exited");
            } else {
              resolve(void 0);
            }
          });
        });
        // Wait for tcmu to overlaybd to fully initialize
        for (let i = 0; i < 100; i += 1) {
          try {
            await fs.readFile(path.join(blockRegistryRoot, "logs", "overlaybd.log"), "utf-8");
            break;
          } catch (err) {
            await sleep(5);
          }
          if (i == 99) {
            throw new Error("TCMU failed to initialize");
          }
        }

        tcmuSubprocess = [cp, cpWait];
      } else {
        cpWait = Promise.resolve();
      }
      const testPromise = testFn({ brService, injector, runId });
      // Either the test finishes/crashes or overlaybd crashes/finishes
      await Promise.race([testPromise, cpWait]);
    } catch (err) {
      if (process.env["BUILDKITE_AGENT_ACCESS_TOKEN"] !== void 0) {
        const archivePath = testRunDir + ".tar.gz";
        // TODO: Perhaps only upload the logs?
        await execCmd(
          "tar",
          "--hole-detection=seek",
          "--sparse",
          "-zcf",
          archivePath,
          "-C",
          testsDir,
          runId,
        );
        try {
          await execCmdWithOpts(["buildkite-agent", "artifact", "upload", runId + ".tar.gz"], {
            cwd: testsDir,
          });
        } finally {
          await fs.unlink(archivePath);
        }
        console.error(`Failed run id: ${runId}. Please consult the artifact ${runId}.tar.gz`);
      } else {
        console.error(
          `Failed run id: ${runId}. Please investigate ../hocus-resources/tests/${runId}`,
        );
        keepStorage = true;
      }
      throw err;
    } finally {
      if (!opts.skipInit) {
        // First check the kernel logs cause if we borked the kernel then
        // all sanity is gone and the cleanup will probably hang .-.
        await ensureKernelDidNotBlowUp();
        try {
          // Check if we have the subtype
          await brService.getTCMUSubtype();
          await brService.hideEverything();
        } catch (err) {
          console.error(`[${runId}] Failed to cleanup registry ${(err as Error).message}`);
        }
        if (!keepStorage) {
          await fs.rm(testRunDir, { recursive: true, force: true });
        }
      }
      if (tcmuSubprocess !== void 0) {
        shouldTerminate = true;
        tcmuSubprocess[0].kill("SIGINT");
        await tcmuSubprocess[1];
      }

      await injector.dispose();
    }
  }, runId);
};

// I have never suspected that I legitimately need to worry about this case
async function ensureKernelDidNotBlowUp() {
  /*try {
    // Grep returns status 1 when no matches were found
    await execCmd("bash", "-c", 'dmesg | grep -i -E "Kernel BUG|invalid opcode|corruption| RIP:"');
    console.error((await execCmd("dmesg")).stdout);
    throw new Error("Looks like the kernel blew up, please reboot the CI machine...");
  } catch (err) {
    if (err instanceof ExecCmdError && err.status !== 1) throw err;
  }*/
}
