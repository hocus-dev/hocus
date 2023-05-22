import type { WorkflowExecutionStatusName } from "@temporalio/client";

import type { CreateActivity } from "../types";

import { NotFoundExecutionStatus } from "./shared";

import { Token } from "~/token";

export type GetWorkflowStatusActivity = (
  workflowId: string,
) => Promise<WorkflowExecutionStatusName | NotFoundExecutionStatus>;
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
            return NotFoundExecutionStatus;
          }
          throw err;
        });
    });
  };
