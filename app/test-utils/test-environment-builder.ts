// must be the first import
import "./prisma-export-patch.server";

import { spawn } from "child_process";
import fs from "fs/promises";
import { join } from "path";
import { formatWithOptions } from "util";

import type { Prisma } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import type { Logger, LogLevel } from "@temporalio/worker";
import { DefaultLogger } from "@temporalio/worker";
import type { Any } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

import type { BlockRegistryService } from "~/agent/block-registry/registry.service";
import type { Config } from "~/config";
import { config as defaultConfig } from "~/config";
import type { Injector, ProvidersOverrides } from "~/di/injector.server";
import { Scope } from "~/di/injector.server";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { TEST_STATE_MANAGER_REQUEST_TAG } from "~/test-state-manager/api";
import type { TestStateManager } from "~/test-state-manager/client";
import { Token } from "~/token";
import { sleep, waitForPromises } from "~/utils.shared";

const DB_HOST = process.env.DB_HOST ?? "localhost";

// WARNING: Only use this in tests in you know what you're doing
export function discoverCaller(): string {
  let caller = "[UNKNOWN]";
  // Play some 4D chess
  const o = Error.prepareStackTrace;
  try {
    if (o) {
      Error.prepareStackTrace = (err, stackTraces) => {
        // We need to use the original formatter for source maps to apply properly
        caller = o(err, [stackTraces[2]]).match(/.*?\((.*)\)/)[1];
      };
      const a = new Error();
      void a.stack;
    }
  } finally {
    Error.prepareStackTrace = o;
  }
  return caller;
}

// Early init functions run before the dependency injector is created,
// and their results are used to override the default providers.
// They are used to asynchronously create nontrivial dependencies because
// the current DI framework doesn't allow resolving async dependencies.
type EarlyInitFunction = (ctx: {
  // The test run id
  runId: string;
  // All EarlyInitFunctions are executed concurrently during init
  // Here is a map of all the init promises in case you want to wait
  // for some other init task to complete. For ex. if your init task
  // has a dependency on the logger you may wait for it here
  earlyInitPromises: Record<string, Promise<any>>;
  // For closing open handles. Don't use this to guarantee some operation will be executed
  addTeardownFunction: (task: () => Promise<void>) => void;
}) => Promise<ProvidersOverrides<any>>;
type EarlyInitMap = Record<string, EarlyInitFunction>;

// Late Init functions operate on an already existing injector and are meant to either:
// - Augment the test context with extra values
// - Run nontrivial initialization on some service
// - Register some state with the state manager server
type LateInitFunction<InjectorT, T> = (ctx: {
  // The requested injector
  injector: InjectorT;
  // The test run id
  runId: string;
  // All LateInitFunctions are executed concurrently during init
  // Here is a map of all the init promises in case you want to wait
  // for some other init task to complete. For ex. if your init task
  // has a dependency on the logger you may wait for it here
  lateInitPromises: Record<string, Promise<any>>;
  // For closing open handles, don't use this to guarantee some operation will be executed
  addTeardownFunction: (task: () => Promise<void>) => void;
}) => Promise<T>;
type LateInitMap<InjectorT> = Record<string, LateInitFunction<InjectorT, any>>;

export class TestEnvironmentBuilder<
  InjectorT extends Injector<any, any, any>,
  OverridesT extends ProvidersOverrides<any>,
  EarlyInitT extends EarlyInitMap,
  LateInitT extends LateInitMap<InjectorT>,
> {
  constructor(
    private readonly injectorCtor: (overrides?: OverridesT) => InjectorT,
    private readonly injectorOverrides: OverridesT = {} as any,
    private readonly earlyInit: EarlyInitT = {} as any,
    private readonly lateInit: LateInitT = {} as any,
  ) {}

  run(
    testFn: (
      context: Any.Compute<
        { injector: InjectorT; runId: string } & Record<string, never> & {
            [K in keyof LateInitT]: Awaited<ReturnType<LateInitT[K]>>;
          },
        "flat"
      >,
    ) => Promise<void>,
  ): () => Promise<void> {
    const testLocation = discoverCaller();
    return async () => {
      let teardownTasks: (() => Promise<void>)[] = [];
      const addTeardownFunction = (task: () => Promise<void>): void => {
        teardownTasks.push(task);
        void 0;
      };
      let runId = uuidv4();
      await this.#getStateManager().mkRequest(TEST_STATE_MANAGER_REQUEST_TAG.TEST_START, {
        runId,
        testsDirMountPath: this.#getStateManager().testStorageDir,
      });
      let testFailed = true;
      try {
        const earlyInitPromises: {
          [K in keyof EarlyInitT]: Promise<any>;
        } = {} as any;
        for (const [key, asyncEarlyInit] of Object.entries(this.earlyInit)) {
          earlyInitPromises[key as keyof EarlyInitT] = asyncEarlyInit({
            runId,
            earlyInitPromises,
            addTeardownFunction,
          });
        }
        let earlyInjectorOverrides: ProvidersOverrides<any> = {} as any;
        for (const [_key, promise] of Object.entries(earlyInitPromises)) {
          const res = await promise;
          earlyInjectorOverrides = { ...res, ...earlyInjectorOverrides };
        }

        const injector = this.injectorCtor({
          ...earlyInjectorOverrides,
          ...this.injectorOverrides,
        });

        const lateInitPromises: {
          [K in keyof LateInitT]: Promise<any>;
        } = {} as any;
        for (const [key, asyncLateInit] of Object.entries(this.lateInit)) {
          lateInitPromises[key as keyof LateInitT] = asyncLateInit({
            injector,
            runId,
            lateInitPromises,
            addTeardownFunction,
          });
        }
        const extraCtx: {
          [K in keyof LateInitT]: Awaited<ReturnType<LateInitT[K]>>;
        } = {} as any;
        for (const [key, promise] of Object.entries(lateInitPromises)) {
          const res = await promise;
          extraCtx[key as keyof LateInitT] = res;
        }
        const res = await testFn({ injector, runId, ...(extraCtx as any) });
        testFailed = false;
        return res;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[${testLocation}]\nFailed test run`, runId, err, JSON.stringify(err));
        throw err;
      } finally {
        const rsp = await this.#getStateManager().mkRequest(
          TEST_STATE_MANAGER_REQUEST_TAG.TEST_END,
          {
            runId,
            testFailed,
          },
        );
        if (rsp.artifactsMsg) {
          // eslint-disable-next-line no-console
          console.error(`[${testLocation}]\n${rsp.artifactsMsg}`);
        }
        await waitForPromises(teardownTasks.map((teardownFn) => teardownFn()));
      }
    };
  }

  withEarlyInits<T extends LateInitMap<InjectorT>>(
    arg: T,
  ): TestEnvironmentBuilder<InjectorT, OverridesT, EarlyInitT & T, LateInitT> {
    return new TestEnvironmentBuilder(
      this.injectorCtor,
      this.injectorOverrides,
      { ...arg, ...this.earlyInit },
      this.lateInit,
    );
  }

  withLateInits<T extends LateInitMap<InjectorT>>(
    arg: T,
  ): TestEnvironmentBuilder<InjectorT, OverridesT, EarlyInitT, LateInitT & T> {
    return new TestEnvironmentBuilder(this.injectorCtor, this.injectorOverrides, this.earlyInit, {
      ...arg,
      ...this.lateInit,
    });
  }

  withInjectorOverrides<T extends ProvidersOverrides<any>>(
    overrides: T,
  ): TestEnvironmentBuilder<InjectorT, T & OverridesT, EarlyInitT, LateInitT> {
    return new TestEnvironmentBuilder(
      this.injectorCtor,
      { ...overrides, ...this.injectorOverrides },
      this.earlyInit,
      this.lateInit,
    );
  }

  #getStateManager(): TestStateManager {
    return (globalThis as any).stateManager as TestStateManager;
  }

  // Sets up obtaining debug logs from the app
  withTestLogging(
    logLevel: LogLevel = "DEBUG",
  ): TestEnvironmentBuilder<
    InjectorT,
    OverridesT,
    EarlyInitT & { logger: EarlyInitFunction },
    LateInitT & { logger: LateInitFunction<InjectorT, Logger> }
  > {
    return new TestEnvironmentBuilder(
      this.injectorCtor,
      this.injectorOverrides,
      {
        logger: async ({ runId, addTeardownFunction }) => {
          const rsp = await this.#getStateManager().mkRequest(
            TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_LOGS_FILE,
            { runId },
          );
          const logsFile = await fs.open(rsp.path, "a");
          let logsEnded = false;
          addTeardownFunction(async () => {
            logsEnded = true;
            await logsFile.close();
          });
          return {
            [Token.Logger]: {
              provide: {
                factory: function () {
                  const format = formatWithOptions.bind(undefined, { colors: true });
                  return new DefaultLogger(logLevel, async (entry) => {
                    entry.meta = entry.meta === void 0 ? {} : entry.meta;
                    entry.meta["runId"] = runId;
                    const { level, timestampNanos, message, meta } = entry;
                    const date = new Date(Number(timestampNanos / 1000000n));
                    if (!logsEnded) {
                      await logsFile.write(
                        `${format(date)} [${level}] [${format(meta)}] ${message} \n`,
                      );
                    } else {
                      // eslint-disable-next-line no-console
                      console.error(
                        "Attempted to log after test ended",
                        `${format(date)} [${level}] [${format(meta)}] ${message} \n`,
                      );
                    }
                  });
                },
              },
              scope: Scope.Singleton,
            },
          };
        },
        ...this.earlyInit,
      },
      {
        logger: async ({ injector }) => injector.resolve(Token.Logger) as Logger,
        ...this.lateInit,
      },
    );
  }

  withTestDb(): TestEnvironmentBuilder<
    InjectorT,
    OverridesT,
    EarlyInitT,
    LateInitT & { db: LateInitFunction<InjectorT, Prisma.NonTransactionClient> }
  > {
    return new TestEnvironmentBuilder(this.injectorCtor, this.injectorOverrides, this.earlyInit, {
      db: async ({ runId, addTeardownFunction }) => {
        const rsp = await this.#getStateManager().mkRequest(
          TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_DATABASE,
          { runId, prismaSchemaPath: "prisma/schema.prisma" },
        );
        const dbUrl = `postgresql://postgres:pass@${DB_HOST}:5432/${rsp.dbName}`;

        const db = new PrismaClient({
          datasources: {
            db: { url: dbUrl },
          },
        });

        addTeardownFunction(async () => {
          await db.$disconnect();
        });

        return db;
      },
      ...this.lateInit,
    });
  }

  // TODO: Create a withWorker helper ;)
  withTimeSkippingTemporal(): TestEnvironmentBuilder<
    InjectorT,
    OverridesT,
    EarlyInitT,
    LateInitT & {
      workflowBundle: LateInitFunction<InjectorT, any>;
      temporalTestEnv: LateInitFunction<InjectorT, TestWorkflowEnvironment>;
    }
  > {
    return new TestEnvironmentBuilder(this.injectorCtor, this.injectorOverrides, this.earlyInit, {
      workflowBundle: async () => {
        return await generateTemporalCodeBundle();
      },
      temporalTestEnv: async ({ addTeardownFunction }) => {
        const env = await TestWorkflowEnvironment.createTimeSkipping({
          client: {
            dataConverter: {
              payloadConverterPath: require.resolve("~/temporal/data-converter"),
            },
          },
        });
        addTeardownFunction(async () => {
          await env.teardown();
        });
        return env;
      },
      ...this.lateInit,
    });
  }

  withBlockRegistry(): TestEnvironmentBuilder<
    InjectorT,
    OverridesT,
    EarlyInitT & { brService: EarlyInitFunction },
    LateInitT & { brService: LateInitFunction<InjectorT, BlockRegistryService> }
  > {
    return new TestEnvironmentBuilder(
      this.injectorCtor,
      this.injectorOverrides,
      {
        brService: async ({ runId }) => {
          const rsp = await this.#getStateManager().mkRequest(
            TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_TEST_STATE_DIR,
            { runId },
          );
          const blockRegistryRoot = join(rsp.dirPath, "block-registry");
          return {
            [Token.Config]: {
              provide: {
                value: {
                  ...defaultConfig,
                  agent: () => ({ ...defaultConfig.agent(), blockRegistryRoot }),
                },
              },
            },
          };
        },
        ...this.earlyInit,
      },
      {
        brService: async ({ injector, runId, addTeardownFunction }) => {
          const obdLogRsp = await this.#getStateManager().mkRequest(
            TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_LOGS_FILE,
            { runId },
          );
          const obdLogFile = await fs.open(obdLogRsp.path, "a");

          const brService: BlockRegistryService = injector.resolve(Token.BlockRegistryService);
          const config: Config = injector.resolve(Token.Config);
          const blockRegistryRoot: string = config.agent().blockRegistryRoot;
          await brService.initializeRegistry();
          const cp = spawn(
            "/opt/overlaybd/bin/overlaybd-tcmu",
            [join(blockRegistryRoot, "overlaybd.json")],
            { stdio: ["ignore", obdLogFile.fd, obdLogFile.fd] },
          );
          const cpWait = new Promise<void>((resolve, reject) => {
            cp.on("error", reject);
            cp.on("close", () => {
              void obdLogFile.close();
              resolve(void 0);
            });
          });
          // Wait for tcmu to overlaybd to fully initialize
          for (let i = 0; i < 100; i += 1) {
            try {
              await fs.readFile(join(blockRegistryRoot, "logs", "overlaybd.log"), "utf-8");
              break;
            } catch (err) {
              await sleep(5);
            }
            if (i == 99) {
              throw new Error("TCMU failed to initialize");
            }
          }

          await this.#getStateManager().mkRequest(
            TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_BLOCK_REGISTRY_WATCH,
            {
              runId,
              blockRegistryDir: blockRegistryRoot,
              tcmuSubtype: await brService.getTCMUSubtype(),
            },
          );

          addTeardownFunction(async () => {
            await brService.hideEverything();
            cp.kill("SIGINT");
            let timeout: NodeJS.Timeout | undefined;
            await Promise.race([
              cpWait,
              new Promise((resolve) => {
                timeout = setTimeout(() => {
                  cp.kill("SIGKILL");
                  resolve(void 0);
                }, 1000);
              }),
            ]);
            clearTimeout(timeout);
          });

          return brService;
        },
        ...this.lateInit,
      },
    );
  }
}
