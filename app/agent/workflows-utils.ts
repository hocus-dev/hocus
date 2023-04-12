import { ActivityFailure } from "@temporalio/workflow";

export const parseGitSyncError = (error: unknown): string => {
  const unknownReasonMsg = "Please check Hocus agent logs for more details.";
  if (error instanceof ActivityFailure) {
    if (error.cause instanceof Error) {
      return error.cause.message;
    }
    return unknownReasonMsg;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return unknownReasonMsg;
};
