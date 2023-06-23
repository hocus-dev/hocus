// must be the first import
import "./prisma-export-patch.server";

import assert from "assert";
import fs from "fs/promises";
import { join } from "path";
import { formatWithOptions, format } from "util";

import type { Prisma } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import type { LogEntry, Logger, LogLevel } from "@temporalio/worker";
import { Runtime } from "@temporalio/worker";
import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import type { AgentProviderOverrides } from "~/agent/agent-injector";
import type { ContainerId, ImageId } from "~/agent/block-registry/registry.service";
import { BlockRegistryService } from "~/agent/block-registry/registry.service";
import type { Config } from "~/config";
import { config as defaultConfig } from "~/config";
import type { Injector, ProvidersOverrides } from "~/di/injector.server";
import { Scope } from "~/di/injector.server";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { TEST_STATE_MANAGER_REQUEST_TAG } from "~/test-state-manager/api";
import type { TestStateManager } from "~/test-state-manager/client";
import type { TimeService } from "~/time.service";
import { Token } from "~/token";
import { runOnTimeout } from "~/utils.server";
import { genFormattedTimestamp, waitForPromises } from "~/utils.shared";

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
    private readonly postTest: ((
      ctx: { injector: InjectorT; runId: string } & {
        [K in keyof LateInitT]: Awaited<ReturnType<LateInitT[K]>>;
      },
    ) => Promise<void>)[] = [] as any,
  ) {}

  run(
    testFn: (
      context: { injector: InjectorT; runId: string } & {
        [K in keyof LateInitT]: Awaited<ReturnType<LateInitT[K]>>;
      },
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
        let resolveLateInitBarrier = (_?: unknown) => {};
        const lateInitBarrier = new Promise((resolve) => (resolveLateInitBarrier = resolve));
        for (const [key, asyncLateInit] of Object.entries(this.lateInit)) {
          lateInitPromises[key as keyof LateInitT] = lateInitBarrier.then(() =>
            asyncLateInit({
              injector,
              runId,
              lateInitPromises,
              addTeardownFunction,
            }),
          );
        }
        resolveLateInitBarrier();

        const extraCtx: {
          [K in keyof LateInitT]: Awaited<ReturnType<LateInitT[K]>>;
        } = {} as any;
        for (const [key, promise] of Object.entries(lateInitPromises)) {
          const res = await promise;
          extraCtx[key as keyof LateInitT] = res;
        }
        const fullCtx = { injector, runId, ...(extraCtx as any) };
        const res = await testFn(fullCtx);
        testFailed = false;

        for (const postTestFn of this.postTest) {
          await postTestFn(fullCtx);
        }

        return res;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[${testLocation}]\nFailed test run`, runId, err);
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

  withEarlyInits(
    arg: EarlyInitMap,
  ): TestEnvironmentBuilder<InjectorT, OverridesT, EarlyInitT & EarlyInitMap, LateInitT> {
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
    EarlyInitT & { withTimeSkippingTemporal: EarlyInitFunction },
    LateInitT & {
      workflowBundle: LateInitFunction<InjectorT, any>;
      temporalTestEnv: LateInitFunction<InjectorT, TestWorkflowEnvironment>;
      taskQueue: LateInitFunction<InjectorT, string>;
      suppressLogPattern: LateInitFunction<InjectorT, (pattern: string | RegExp) => number>;
      unsuppressLogPattern: LateInitFunction<InjectorT, (patternId: number) => void>;
    }
  > {
    let logPatternCounter = 0;
    const suppressedPatterns = new Map<string, Map<number, RegExp | string>>();
    Runtime.install({
      logger: new DefaultLogger("WARN", (entry: LogEntry) => {
        const logMessage = `[${entry.level}] ${format(entry.message)}, ${format(entry.meta)}`;
        const shouldLog: boolean = (() => {
          const taskQueue = entry.meta?.taskQueue;
          if (typeof taskQueue !== "string") {
            return true;
          }
          const suppressedPatternsForTaskQueue = suppressedPatterns.get(taskQueue);
          if (suppressedPatternsForTaskQueue === void 0) {
            return true;
          }
          for (const pattern of suppressedPatternsForTaskQueue.values()) {
            if (typeof pattern === "string") {
              if (logMessage.includes(pattern)) {
                return false;
              }
            } else {
              if (pattern.test(logMessage)) {
                return false;
              }
            }
          }
          return true;
        })();
        if (shouldLog) {
          // eslint-disable-next-line no-console
          console.log(logMessage);
        }
      }),
    });
    const temporalDependencies = (async () => {
      const bundle = await generateTemporalCodeBundle();
      const env = await TestWorkflowEnvironment.createLocal({
        client: {
          dataConverter: {
            payloadConverterPath: require.resolve("~/temporal/data-converter"),
          },
        },
      });
      return { bundle, env };
    })();
    return new TestEnvironmentBuilder(
      this.injectorCtor,
      this.injectorOverrides,
      {
        ...this.earlyInit,
        withTimeSkippingTemporal: async () => {
          const { env } = await temporalDependencies;
          const result: AgentProviderOverrides = {
            [Token.TemporalClient]: {
              provide: {
                factory: () => (fn) => fn(env.client),
              },
            },
          };
          return result;
        },
      },
      {
        ...this.lateInit,
        workflowBundle: async () => {
          return (await temporalDependencies).bundle;
        },
        temporalTestEnv: async ({ addTeardownFunction }) => {
          const env = (await temporalDependencies).env;
          addTeardownFunction(async () => {
            await env.teardown();
          });
          return env;
        },
        taskQueue: async ({ runId }) => runId,
        suppressLogPattern: async ({ lateInitPromises }) => {
          const taskQueue = await lateInitPromises.taskQueue;
          assert(typeof taskQueue === "string");
          return (pattern) => {
            const idx = logPatternCounter++;
            const suppressedPatternsForTaskQueue = suppressedPatterns.get(taskQueue);
            if (suppressedPatternsForTaskQueue === void 0) {
              suppressedPatterns.set(taskQueue, new Map([[idx, pattern]]));
            } else {
              suppressedPatternsForTaskQueue.set(idx, pattern);
            }
            return idx;
          };
        },
        unsuppressLogPattern: async ({ lateInitPromises }) => {
          const taskQueue = await lateInitPromises.taskQueue;
          assert(typeof taskQueue === "string");
          return (idx) => {
            const suppressedPatternsForTaskQueue = suppressedPatterns.get(taskQueue);
            if (suppressedPatternsForTaskQueue !== void 0) {
              suppressedPatternsForTaskQueue.delete(idx);
            }
          };
        },
      },
    );
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
          const runtimeStateRoot = join(rsp.dirPath, "runtime");
          return {
            [Token.Config]: {
              provide: {
                value: {
                  ...defaultConfig,
                  agent: () => ({ ...defaultConfig.agent(), blockRegistryRoot, runtimeStateRoot }),
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

          const brService: BlockRegistryService = injector.resolve(Token.BlockRegistryService);
          const config: Config = injector.resolve(Token.Config);
          const blockRegistryRoot: string = config.agent().blockRegistryRoot;
          await brService.initializeRegistry();
          const [cp, cpWait] = await brService.startOverlaybdProcess({
            logFilePath: obdLogRsp.path,
          });

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
            await runOnTimeout({ waitFor: cpWait, timeoutMs: 1000 }, () => cp.kill("SIGKILL"));
          });

          return brService;
        },
        ...this.lateInit,
      },
    );
  }

  /**
   * Pushes chosen images generated by the test to the OCI registry specified in the tag.
   */
  withImagePush(
    chooseImages: (
      /** a formatted timestamp in the format `YYYY-MM-DD-HH-MM-SS` */
      formattedTimestamp: string,
    ) => { tag: string; imageId: ImageId | ContainerId }[],
  ): TestEnvironmentBuilder<InjectorT, OverridesT, EarlyInitT, LateInitT> {
    return new TestEnvironmentBuilder(
      this.injectorCtor,
      this.injectorOverrides,
      this.earlyInit,
      this.lateInit,
      [
        ...this.postTest,
        async (ctx) => {
          const { injector } = ctx;
          const config: Config = injector.resolve(Token.Config);
          const {
            testOutputOciRegistryUsername: username,
            testOutputOciRegistryPassword: password,
          } = config.tests();
          if (!username || !password) {
            return;
          }
          const brService = ctx.brService as any;
          assert(
            brService instanceof BlockRegistryService,
            "BlockRegistryService not initialized. Did you forget to call withBlockRegistry()?",
          );
          const timeService: TimeService = injector.resolve(Token.TimeService);
          const timestamp = genFormattedTimestamp(timeService.now());
          const images = chooseImages(timestamp);
          /* eslint-disable no-console */
          console.log(
            `OCI registry credentials found. Images with tags ${images
              .map((i) => `"${i.tag}"`)
              .join(", ")} will be pushed to the registry.`,
          );

          for (const { tag, imageId: suppliedImageId } of images) {
            let imageId: ImageId;
            if (BlockRegistryService.isContainerId(suppliedImageId)) {
              imageId = await brService.commitContainer(suppliedImageId, uuidv4());
            } else {
              imageId = suppliedImageId;
            }
            console.log(`Pushing ${tag} to OCI registry...`);
            await brService.pushImage(imageId, { tag, username, password });
            console.log(`Pushed ${tag} to OCI registry.`);
          }
          /* eslint-enable no-console */
        },
      ],
    );
  }
}
