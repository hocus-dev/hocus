import { ActivityFailure } from "@temporalio/workflow";

import { retryWorkflow } from "~/temporal/utils";

const getErrorMessage = (error: Error): string => {
  if (error.stack != null) {
    return `${error.message}\n${error.stack}`;
  }
  return error.message;
};

export const parseWorkflowError = (error: unknown): string => {
  const unknownReasonMsg = "Please check Hocus agent logs for more details.";
  if (error instanceof ActivityFailure) {
    if (error.cause instanceof Error) {
      return getErrorMessage(error.cause);
    }
    return unknownReasonMsg;
  }
  if (error instanceof Error) {
    return getErrorMessage(error);
  }
  return unknownReasonMsg;
};

export const WORKFLOW_EXECUTION_NOT_FOUND_ERR_TYPE = "ExternalWorkflowExecutionNotFound";
export const retrySignal = (fn: () => Promise<void>): Promise<void> =>
  retryWorkflow(fn, {
    maxRetries: 10,
    retryIntervalMs: 250,
    maxRetryIntervalMs: 60 * 1000,
    isExponential: true,
    isRetriable: (err: any) => err?.type !== WORKFLOW_EXECUTION_NOT_FOUND_ERR_TYPE,
  });
