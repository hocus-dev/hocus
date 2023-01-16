import { ApplicationFailure, sleep } from "@temporalio/workflow";
import { waitForPromises } from "~/utils.shared";

export const wrapWorkflowError = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error) {
      throw new ApplicationFailure(e.message, null, null, null, e);
    }
    const asString = String(e);
    throw new ApplicationFailure(asString, null, null, null, new Error(asString));
  }
};

export const waitForPromisesWorkflow: typeof waitForPromises = async (args) => {
  return await wrapWorkflowError(() => waitForPromises(args));
};

export const retryWorkflow = async <T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    retryIntervalMs: number;
    isRetriable?: (err: unknown) => boolean;
  },
): Promise<T> => {
  const isRetriable = options.isRetriable ?? (() => true);
  let lastError: unknown = void 0;
  for (let i = 0; i < options.maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetriable(err)) {
        throw err;
      }
      lastError = err;
      if (i < options.maxRetries - 1) {
        await sleep(options.retryIntervalMs);
      }
    }
  }
  throw lastError;
};
