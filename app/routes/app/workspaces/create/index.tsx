import { PrebuildEventStatus } from "@prisma/client";
import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";

import { runCreateWorkspace } from "~/agent/workflows";
import { HttpError } from "~/http-error.server";
import { getUserSettingsPath, getWorkspacePath, SettingsPageTab } from "~/page-paths.shared";
import { CreateWorkspaceFormValidator } from "~/schema/create-workspace-form.validator.server";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export const action = async ({ context: { app, db, req, user } }: ActionArgs) => {
  const withClient = app.resolve(Token.TemporalClient);
  const workspaceService = app.resolve(Token.WorkspaceService);
  const userService = app.resolve(Token.UserService);
  const formData = req.body;
  const { success, value: workspaceInfo } = CreateWorkspaceFormValidator.SafeParse(formData);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid form data");
  }
  const prebuildEvent = await db.prebuildEvent.findUnique({
    where: { externalId: workspaceInfo.prebuildEventId },
    include: {
      gitObject: {
        include: {
          gitObjectToBranch: {
            include: {
              gitBranch: true,
            },
          },
        },
      },
    },
  });
  if (prebuildEvent == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Prebuild not found");
  }
  const gitBranch = prebuildEvent.gitObject.gitObjectToBranch.find(
    (link) => link.gitBranch.externalId === workspaceInfo.gitBranchId,
  )?.gitBranch;
  if (gitBranch == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Git branch not found");
  }
  if (prebuildEvent.status !== PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS) {
    throw new HttpError(
      StatusCodes.BAD_REQUEST,
      "Prebuild must be in the success state for a workspace to be created",
    );
  }

  const missingSshKeys = await userService.isUserMissingSshKeys(db, unwrap(user).id);
  if (missingSshKeys) {
    return redirect(getUserSettingsPath(SettingsPageTab.SshKeys));
  }

  const externalWorkspaceId = uuidv4();
  const workspaceName = workspaceService.generateWorkspaceName();

  await withClient(async (client) => {
    return await client.workflow.start(runCreateWorkspace, {
      workflowId: uuidv4(),
      taskQueue: MAIN_TEMPORAL_QUEUE,
      retry: { maximumAttempts: 1 },
      args: [
        {
          name: workspaceName,
          externalId: externalWorkspaceId,
          prebuildEventId: prebuildEvent.id,
          gitBranchId: gitBranch.id,
          userId: unwrap(user).id,
          startWorkspace: true,
        },
      ],
    });
  });

  return redirect(
    getWorkspacePath(externalWorkspaceId, {
      justCreated: true,
      justStarted: true,
      shouldOpen: true,
    }),
  );
};
