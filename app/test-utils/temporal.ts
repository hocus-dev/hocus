import { format } from "util";

import { TestWorkflowEnvironment } from "@temporalio/testing";
import type { LogEntry } from "@temporalio/worker";
import { DefaultLogger, Runtime } from "@temporalio/worker";
import { Mutex } from "async-mutex";
import portfinder from "portfinder";

let testEnv: TestWorkflowEnvironment | undefined = void 0;
let temporalPort: number = 0;
const host = "127.0.0.1";
const suppressedLogPatterns = new Map<string, Array<string | RegExp>>();
const mutex = new Mutex();

export const initTemporal = async (): Promise<{
  env: TestWorkflowEnvironment;
  host: string;
  port: number;
}> => {
  return mutex.runExclusive(async () => {
    if (testEnv != null) {
      return { env: testEnv, host, port: temporalPort };
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
    const { port, env } = await portfinder.getPortPromise().then(async (port) => ({
      port,
      env: await TestWorkflowEnvironment.createLocal({
        server: {
          ip: "127.0.0.1",
          port,
        },
        client: {
          dataConverter: {
            payloadConverterPath: require.resolve("~/temporal/data-converter"),
          },
        },
      }),
    }));
    testEnv = env;
    temporalPort = port;
    return { env, host, port };
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
