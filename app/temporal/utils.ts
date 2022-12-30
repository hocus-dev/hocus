import { ApplicationFailure } from "@temporalio/workflow";
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
