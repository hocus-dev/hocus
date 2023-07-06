import * as sinon from "ts-sinon";
import type { Class } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

import { GroupError } from "./group-error";

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

export const printErrors = <T>(testFn: () => Promise<T>, runId?: string): (() => Promise<T>) => {
  return async () => {
    try {
      return await testFn();
    } catch (err) {
      /* eslint-disable no-console */
      if (err instanceof GroupError) {
        for (const innerError of err.errors) {
          console.error(`[${runId}] ${JSON.stringify(innerError)}`);
        }
        if (err.errors.length === 0) {
          console.error(`[${runId}] ${JSON.stringify(err)}`);
        }
      } else {
        console.error(`[${runId}] ${JSON.stringify(err)}`);
      }
      /* eslint-enable no-console */
      throw err;
    }
  };
};
