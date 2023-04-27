import type { GitObject, Project } from "@prisma/client";
import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";

import { scheduleNewPrebuild } from "~/agent/workflows";
import { HttpError } from "~/http-error.server";
import { getPrebuildPath } from "~/page-paths.shared";
import { SchedulePrebuildValidator } from "~/schema/schedule-prebuild.validator.server";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

export const action = async ({ context: { app, db, req } }: ActionArgs) => {
  const withClient = app.resolve(Token.TemporalClient);
  const formData = req.body;
  const { success, value: prebuildInfo } = SchedulePrebuildValidator.SafeParse(formData);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid form data");
  }
  const [project, gitObject] = (await waitForPromises([
    db.project.findUnique({ where: { externalId: prebuildInfo.projectExternalId } }),
    db.gitObject.findUnique({ where: { hash: prebuildInfo.gitObjectHash } }),
  ])) as [Project | null, GitObject | null];
  if (project == null) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Project not found");
  }
  if (gitObject == null) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Git object not found");
  }

  const { prebuildEvent } = await withClient((client) =>
    client.workflow
      .start(scheduleNewPrebuild, {
        workflowId: uuidv4(),
        taskQueue: MAIN_TEMPORAL_QUEUE,
        retry: { maximumAttempts: 1 },
        args: [{ projectId: project.id, gitObjectId: gitObject.id }],
      })
      .then((handle) => handle.result()),
  );

  return redirect(getPrebuildPath(prebuildEvent.externalId));
};

export default function DefaultView() {
  return null;
}
