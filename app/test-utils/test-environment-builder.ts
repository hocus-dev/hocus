// must be the first import
import "./prisma-export-patch.server";

import fs from "fs/promises";
import { formatWithOptions } from "util";

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Prisma, PrismaClient } from "@prisma/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import type { Logger, LogLevel } from "@temporalio/worker";
import { DefaultLogger } from "@temporalio/worker";
import { Client as PgClient } from "pg";
import * as build from "prisma/build";
import { v4 as uuidv4 } from "uuid";

import type { Injector, ProvidersOverrides } from "~/di/injector.server";
import { Scope } from "~/di/injector.server";
import { generateTemporalCodeBundle } from "~/temporal/bundle";
import { TEST_STATE_MANAGER_REQUEST_TAG } from "~/test-state-manager/api";
import type { TestStateManager } from "~/test-state-manager/client";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

const DB_HOST = process.env.DB_HOST ?? "localhost";

const changeSequenceNumbers = async (db: Prisma.NonTransactionClient): Promise<void> => {
  const modelNames = Object.values(Prisma.ModelName).sort((a, b) => a.localeCompare(b));
  await waitForPromises(
    modelNames.map((name, idx) =>
      // When you pass model ids around, it's easy to accidentally pass an id representing one model
      // to a function that expects an id representing another model. By changing the sequence numbers
      // so that every model has its own range of ids, we can easily detect this kind of error
      // during testing.
      db.$executeRawUnsafe(`ALTER SEQUENCE "${name}_id_seq" RESTART WITH ${(idx + 1) * 1000000}`),
    ),
  );
};

// Early init functions operate before the dependency injector was created
// and are meant to asynchronously create non trivial dependencies
// The current DI framework doesn't allow to resolve async dependencies
type EarlyInitFunction = (ctx: {
  // The test run id
  runId: string;
  // All startup tasks so if for ex a startup task requires a db connection then the task may wait for it
  earlyInitPromises: Record<string, Promise<any>>;
  // For closing open handles, don't use this to guarantee some operation will be executed
  addTeardownFunction: (task: () => Promise<void>) => void;
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
      context: { injector: InjectorT; runId: string } & {
        [K in keyof LateInitT]: Awaited<ReturnType<LateInitT[K]>>;
      },
    ) => Promise<void>,
  ): () => Promise<void> {
    return async () => {
      let teardownTasks: (() => Promise<void>)[] = [];
      const addTeardownFunction = (task: () => Promise<void>): void => {
        teardownTasks.push(task);
        void 0;
      };
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
        const res = await testFn({ injector, runId, ...extraCtx });
        testFailed = false;
        return res;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed test run", runId, JSON.stringify(err));
        throw err;
      } finally {
        await this.#getStateManager().mkRequest(TEST_STATE_MANAGER_REQUEST_TAG.TEST_END, {
          runId,
          testFailed,
        });
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
    EarlyInitT,
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
          addTeardownFunction(async () => {
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

  withTestDb(): TestEnvironmentBuilder<
    InjectorT,
    OverridesT,
    EarlyInitT,
    LateInitT & { db: LateInitFunction<InjectorT, Prisma.NonTransactionClient> }
  > {
    return new TestEnvironmentBuilder(this.injectorCtor, this.injectorOverrides, this.earlyInit, {
      db: async ({ runId, addTeardownFunction }) => {
        const dbName = runId;
        const dbUrl = `postgresql://postgres:pass@${DB_HOST}:5432/${dbName}`;
        const db = new PrismaClient({
          datasources: {
            db: { url: dbUrl },
          },
        });
        const schemaPath = `prisma/tmp-${dbName}.prisma`;
        const schemaContents = (await fs.readFile("prisma/schema.prisma", "utf-8")).replace(
          `env("PRISMA_DATABASE_URL")`,
          `"${dbUrl}"`,
        );
        await fs.writeFile(schemaPath, schemaContents);

        await build.ensureDatabaseExists("apply", true, schemaPath);
        const migrate = new build.Migrate(schemaPath);

        // eslint-disable-next-line no-console
        console.info = () => {};
        await migrate.applyMigrations();
        await fs.unlink(schemaPath);

        migrate.stop();

        await changeSequenceNumbers(db);

        addTeardownFunction(async () => {
          await db.$disconnect();

          const pgClient = new PgClient({
            user: "postgres",
            password: "pass",
            host: DB_HOST,
            port: 5432,
          });
          const query = `DROP DATABASE "${dbName}";`;
          await pgClient.connect();
          await pgClient.query(query);
          await pgClient.end();
        });

        return db;
      },
      ...this.lateInit,
    });
  }

  // TODO: Create an withWorker helper ;)
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
}
