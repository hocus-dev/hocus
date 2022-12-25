import type { Prisma } from "@prisma/client";
import { DefaultLogger } from "@temporalio/worker";
import type { NodeSSH } from "node-ssh";
import type { Config } from "~/config";
import { printErrors, provideRunId } from "~/test-utils";
import { provideDb } from "~/test-utils/db.server";
import { Token } from "~/token";

import { createAgentInjector } from "./agent-injector";
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

export const provideInjector = (
  testFn: (args: {
    injector: ReturnType<typeof createAgentInjector>;
    runId: string;
  }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAgentInjector({
    [Token.Logger]: function () {
      return new DefaultLogger("ERROR");
    } as unknown as any,
  });
  return printErrors(provideRunId(async ({ runId }) => await testFn({ injector, runId })));
};

export const provideInjectorAndDb = (
  testFn: (args: {
    injector: ReturnType<typeof createAgentInjector>;
    db: Prisma.NonTransactionClient;
  }) => Promise<void>,
): (() => Promise<void>) => {
  return provideInjector(({ injector }) => provideDb((db) => testFn({ injector, db }))());
};
