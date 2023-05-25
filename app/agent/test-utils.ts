import fs from "fs/promises";

import type { Prisma } from "@prisma/client";
import { DefaultLogger } from "@temporalio/worker";
import type { NodeSSH } from "node-ssh";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "./agent-injector";
import type { AgentInjector } from "./agent-injector";
import type { FirecrackerService } from "./firecracker.service";
import { SSH_PROXY_IP } from "./test-constants";
import { execCmdAsync } from "./utils";

import type { Config } from "~/config";
import { Scope } from "~/di/injector.server";
import { printErrors, provideRunId } from "~/test-utils";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";

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
      memSizeMib: 1024,
      vcpuCount: 1,
    },
    async ({ ssh }) => {
      return await fn(ssh, mountPath);
    },
  );
};

export const provideInjector = (
  testFn: (args: { injector: AgentInjector; runId: string }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAgentInjector({
    [Token.Logger]: {
      provide: {
        factory: function () {
          return new DefaultLogger("ERROR");
        },
      },
      scope: Scope.Transient,
    },
  });
  return printErrors(provideRunId(async ({ runId }) => await testFn({ injector, runId })));
};

export const provideInjectorAndDb = (
  testFn: (args: { injector: AgentInjector; db: Prisma.NonTransactionClient }) => Promise<void>,
): (() => Promise<void>) => {
  return provideInjector(({ injector }) => provideDb((db) => testFn({ injector, db }))());
};

export const execSshCmdThroughProxy = async (args: {
  vmIp: string;
  privateKey: string;
  cmd: string;
}): Promise<{ stdout: string; stderr: string }> => {
  const keyPath = `/tmp/${uuidv4()}.key` as const;
  try {
    await fs.writeFile(keyPath, args.privateKey);
    await fs.chmod(keyPath, 0o600);
    return await execCmdAsync(
      "ip",
      "netns",
      "exec",
      "tst",
      "ssh",
      "-o",
      `ProxyCommand=ssh -W %h:%p -o StrictHostKeyChecking=no -i ${keyPath} sshgateway@${SSH_PROXY_IP}`,
      "-o",
      "StrictHostKeyChecking=no",
      "-i",
      keyPath,
      `hocus@${args.vmIp}`,
      args.cmd,
    );
  } finally {
    await fs.unlink(keyPath).catch((_) => {
      // do nothing
    });
  }
};
