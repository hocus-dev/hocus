import path from "path";

import { WorkspaceStatus } from "@prisma/client";
import type { ActionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import { Button } from "flowbite-react";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import { runStartWorkspace } from "~/agent/workflows";
import { AppPage } from "~/components/app-page";
import { HttpError } from "~/http-error.server";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export const action = async ({ context: { app, db, req, user } }: ActionArgs) => {
  const withClient = app.resolve(Token.TemporalClient);
  const { success, value: workspaceExternalId } = UuidValidator.SafeParse(
    path.parse(req.params[0]).name,
  );
  const config = await app.resolve(Token.Config).controlPlane();
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Workspace id must be a UUID");
  }
  const workspace = await db.workspace.findUnique({
    where: { externalId: workspaceExternalId },
    include: { agentInstance: true },
  });
  if (workspace == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Workspace not found");
  }
  if (workspace.userId !== unwrap(user).id) {
    throw new HttpError(StatusCodes.FORBIDDEN, "Workspace does not belong to user");
  }
  if (workspace.status !== WorkspaceStatus.WORKSPACE_STATUS_STOPPED) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Workspace must be stopped before starting");
  }

  const instance = await withClient(async (client) => {
    return await client.workflow.execute(runStartWorkspace, {
      workflowId: uuidv4(),
      taskQueue: MAIN_TEMPORAL_QUEUE,
      retry: { maximumAttempts: 1 },
      args: [workspace.id],
    });
  });

  return json({
    workspaceInstanceId: instance.id.toString(),
    agentHostname: instance.vmIp,
    workspaceHostname: config.agentHostname,
  });
};

export default function ProjectRoute(): JSX.Element {
  const actionData = useActionData<typeof action>();

  return (
    <AppPage>
      <div className="flex flex-col justify-center">
        <div className="flex gap-4">
          <Button
            href={`vscode://hocus.hocus/?agent-hostname=${actionData?.agentHostname}&workspace-hostname=${actionData?.workspaceHostname}`}
            color="success"
            className="transition-all"
          >
            <i className="fa-solid fa-circle-play mr-2"></i>
            <span>Open</span>
          </Button>
          wooo
        </div>
      </div>
      workspace instance id: {actionData?.workspaceInstanceId}{" "}
    </AppPage>
  );
}
