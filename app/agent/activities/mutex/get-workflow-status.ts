import type { WorkflowExecutionStatusName } from "@temporalio/client";

import type { CreateActivity } from "../types";

import { Token } from "~/token";

export type GetWorkflowStatusActivity = (
  workflowId: string,
) => Promise<WorkflowExecutionStatusName>;
export const getWorkflowStatus: CreateActivity<GetWorkflowStatusActivity> =
  ({ injector }) =>
  async (workflowId) => {
    const withClient = injector.resolve(Token.TemporalClient);
    return await withClient(async (client) => {
      const handle = await client.workflow.getHandle(workflowId);
      const description = await handle.describe();
      return description.status.name;
    });
  };
