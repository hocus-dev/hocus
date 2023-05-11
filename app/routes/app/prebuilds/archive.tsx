import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";

import { runArchivePrebuild } from "~/agent/workflows";
import { HttpError } from "~/http-error.server";
import { getPrebuildPath } from "~/page-paths.shared";
import { ArchivePrebuildValidator } from "~/schema/archive-prebuild.validator.server";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";

export const action = async ({ context: { app, db, req } }: ActionArgs) => {
  const withClient = app.resolve(Token.TemporalClient);
  const formData = req.body;
  const { success, error, value: prebuildInfo } = ArchivePrebuildValidator.SafeParse(formData);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, `Invalid form data: ${error.message}`);
  }
  const prebuild = await db.prebuildEvent.findUnique({
    where: { externalId: prebuildInfo.prebuildExternalId },
  });
  if (prebuild == null) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Prebuild not found");
  }

  await withClient((client) =>
    client.workflow.execute(runArchivePrebuild, {
      workflowId: uuidv4(),
      taskQueue: MAIN_TEMPORAL_QUEUE,
      retry: { maximumAttempts: 1 },
      args: [{ prebuildEventId: prebuild.id }],
    }),
  );

  return redirect(getPrebuildPath(prebuild.externalId));
};

export default function DefaultView() {
  return null;
}
