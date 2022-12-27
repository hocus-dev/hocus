import { FetchError, ResponseError } from "firecracker-client";
import * as sinon from "ts-sinon";
import type { Class } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

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
      } else {
        console.error(err);
      }
      /* eslint-enable no-console */
      throw err;
    }
  };
};

export const errToString = (err: unknown): string => {
  if (err instanceof Error) {
    return `${err.message}\nStack: ${err.stack}`;
  }
  return String(err);
};
