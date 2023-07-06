import { format } from "util";

import { getEphemeralServerTarget } from "@temporalio/core-bridge";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import type { LogEntry } from "@temporalio/worker";
import { DefaultLogger, Runtime } from "@temporalio/worker";
import { Mutex } from "async-mutex";

let testEnv: TestWorkflowEnvironment | undefined = void 0;
let address = "";
const suppressedLogPatterns = new Map<string, Array<string | RegExp>>();
const mutex = new Mutex();

export const initTemporal = async (): Promise<{
  env: TestWorkflowEnvironment;
  address: string;
}> => {
  return mutex.runExclusive(async () => {
    if (testEnv != null) {
      return { env: testEnv, address };
    }
    Runtime.install({
      logger: new DefaultLogger("WARN", (entry: LogEntry) => {
        const logMessage = `[${entry.level}] ${format(entry.message)}, ${format(entry.meta)}`;
        const shouldLog: boolean = (() => {
          const taskQueue = entry.meta?.taskQueue;
          if (typeof taskQueue !== "string") {
            return true;
          }
          const suppressedPatternsForTaskQueue = suppressedLogPatterns.get(taskQueue);
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
    testEnv = await TestWorkflowEnvironment.createLocal({
      server: {
        ip: "127.0.0.1",
      },
      client: {
        dataConverter: {
          payloadConverterPath: require.resolve("~/temporal/data-converter"),
        },
      },
    });
    address = getEphemeralServerTarget(testEnv["server"]);
    return { env: testEnv, address };
  });
};

export const suppressLogPattern = (taskQueue: string, pattern: string | RegExp) => {
  const patterns = suppressedLogPatterns.get(taskQueue);
  if (patterns === void 0) {
    suppressedLogPatterns.set(taskQueue, [pattern]);
  } else {
    patterns.push(pattern);
  }
};

export const removeSuppressedLogPatterns = (taskQueue: string): void => {
  suppressedLogPatterns.delete(taskQueue);
};

afterAll(async () => {
  if (testEnv != null) {
    await testEnv.teardown();
    testEnv = void 0;
  }
});
