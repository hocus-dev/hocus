import { DefaultLogger, Logger, LogLevel } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";

import { createAppInjector } from "~/app-injector.server";
import { Injector, ProvidersOverrides, Scope } from "~/di/injector.server";
import { TEST_STATE_MANAGER_REQUEST_TAG } from "~/test-state-manager/api";
import type { TestStateManager } from "~/test-state-manager/client";
import { Token } from "~/token";
import { formatWithOptions } from "util";

// Early init functions operate before the dependency injector was created
// and are meant to asynchronously create non trivial dependencies
// The current DI framework doesn't allow to resolve async dependencies
type EarlyInitFunction = (ctx: {
  // The test run id
  runId: string;
  // All startup tasks so if for ex a startup task requires a db connection then the task may wait for it
  earlyInitPromises: Record<string, Promise<any>>;
}) => Promise<ProvidersOverrides<any>>;
type EarlyInitMap = Record<string, EarlyInitFunction>;

// Late Init functions operate on an already existing injector and are meant to either:
// - Augument the test context with extra values
// - Run non trivial initialization on some service
// - Register some state with the state manager server
type LateInitFunction<InjectorT, T> = (ctx: {
  // The requested injector
  injector: InjectorT;
  // The test run id
  runId: string;
  // All startup tasks so if for ex a startup task requires a db connection then the task may wait for it
  lateInitPromises: Record<string, Promise<any>>;
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
      context: { injector: InjectorT; runId: string } & {
        [K in keyof LateInitT]: Awaited<ReturnType<LateInitT[K]>>;
      },
    ) => Promise<void>,
  ): () => Promise<void> {
    return async () => {
      let runId = uuidv4();
      await this.#getStateManager().mkRequest(TEST_STATE_MANAGER_REQUEST_TAG.TEST_START, { runId });
      let testFailed = true;
      try {
        const earlyInitPromises: {
          [K in keyof EarlyInitT]: Promise<any>;
        } = {} as any;
        for (const [key, asyncEarlyInit] of Object.entries(this.earlyInit)) {
          earlyInitPromises[key as keyof EarlyInitT] = asyncEarlyInit({
            runId,
            earlyInitPromises,
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
          });
        }
        const extraCtx: {
          [K in keyof LateInitT]: Awaited<ReturnType<LateInitT[K]>>;
        } = {} as any;
        for (const [key, promise] of Object.entries(lateInitPromises)) {
          const res = await promise;
          extraCtx[key as keyof LateInitT] = res;
        }
        const res = await testFn({ injector, runId, ...extraCtx });
        testFailed = false;
        return res;
      } catch (err) {
        console.error("Failed test run", runId, JSON.stringify(err));
        throw err;
      } finally {
        await this.#getStateManager().mkRequest(TEST_STATE_MANAGER_REQUEST_TAG.TEST_END, {
          runId,
          testFailed,
        });
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
    EarlyInitT,
    LateInitT & { logger: LateInitFunction<InjectorT, Logger> }
  > {
    return new TestEnvironmentBuilder(
      this.injectorCtor,
      this.injectorOverrides,
      {
        logger: async ({ runId }) => {
          const rsp = await this.#getStateManager().mkRequest(
            TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_LOGS_FILE,
            { runId },
          );
          const logsFile = await fs.open(rsp.path, "a");
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
                    await logsFile.write(
                      `${format(date)} [${level}] [${format(meta)}] ${message} \n`,
                    );
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
}

test.concurrent("TTTT", async () => {
  await new TestEnvironmentBuilder(createAppInjector)
    .withLateInits({ rsre: async () => 20 as const })
    .withLateInits({ a: async () => 40 as const })
    .withLateInits({ g: async () => 80 as const })
    .withTestLogging()
    .run(async ({ logger }) => {
      logger.debug("AAAAA");
      logger.info("SSSSS");
    })();
});
