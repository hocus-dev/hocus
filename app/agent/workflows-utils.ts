import { ActivityFailure } from "@temporalio/workflow";

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
