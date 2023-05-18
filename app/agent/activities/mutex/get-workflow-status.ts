import type { WorkflowExecutionStatusName } from "@temporalio/client";

import type { CreateActivity } from "../types";

import { Token } from "~/token";

export type GetWorkflowStatusActivity = (
  workflowId: string,
) => Promise<WorkflowExecutionStatusName | "CUSTOM_NOT_FOUND">;
export const getWorkflowStatus: CreateActivity<GetWorkflowStatusActivity> =
  ({ injector }) =>
  async (workflowId) => {
    const withClient = injector.resolve(Token.TemporalClient);
    return await withClient(async (client) => {
      const handle = await client.workflow.getHandle(workflowId);
      return await handle
        .describe()
        .then((d) => d.status.name)
        .catch((err) => {
          if (err?.name === "WorkflowNotFoundError") {
            return "CUSTOM_NOT_FOUND";
          }
          throw err;
        });
    });
  };
