import type { Prisma } from "@prisma/client";
import { FetchError, ResponseError } from "firecracker-client";
import * as sinon from "ts-sinon";
import type { Class } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

import { createAppInjector } from "./app-injector.server";
import { GroupError } from "./group-error";
import { provideDb } from "./test-utils/db.server";

export const constructorStub = <T extends Class.Class>(ctor: T) =>
  function () {
    return sinon.stubConstructor(ctor);
  } as unknown as T;

export const provideRunId = <T>(
  testFn: (_: { runId: string }) => Promise<T>,
): (() => Promise<T>) => {
  const runId = uuidv4();
  return async () => {
    try {
      return await testFn({ runId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Test failed with runId: ${runId}`);
      throw err;
    }
  };
};

export const printErrors = <T>(testFn: () => Promise<T>): (() => Promise<T>) => {
  return async () => {
    try {
      return await testFn();
    } catch (err) {
      /* eslint-disable no-console */
      if (err instanceof ResponseError) {
        console.error(
          `Status: ${err.response.status} ${err.response.statusText}\n${await err.response.text()}`,
        );
      } else if (err instanceof FetchError) {
        console.error(err.cause);
      } else if (err instanceof GroupError) {
        for (const innerError of err.errors) {
          console.error(innerError);
        }
        if (err.errors.length === 0) {
          console.error(err);
        }
      } else {
        console.error(err);
      }
      /* eslint-enable no-console */
      throw err;
    }
  };
};

export const provideAppInjector = (
  testFn: (args: { injector: ReturnType<typeof createAppInjector> }) => Promise<void>,
): (() => Promise<void>) => {
  const injector = createAppInjector();
  return printErrors(() => testFn({ injector }));
};

export const provideAppInjectorAndDb = (
  testFn: (args: {
    injector: ReturnType<typeof createAppInjector>;
    db: Prisma.NonTransactionClient;
  }) => Promise<void>,
): (() => Promise<void>) => {
  return provideAppInjector(({ injector }) => provideDb((db) => testFn({ injector, db }))());
};
