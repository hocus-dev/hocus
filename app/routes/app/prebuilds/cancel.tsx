import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";

import { HttpError } from "~/http-error.server";
import { getPrebuildPath } from "~/page-paths.shared";
import { CancelPrebuildValidator } from "~/schema/cancel-prebuild.validator.server";
import { Token } from "~/token";

export const action = async ({ context: { app, db, req } }: ActionArgs) => {
  const withClient = app.resolve(Token.TemporalClient);
  const formData = req.body;
  const { success, error, value: prebuildInfo } = CancelPrebuildValidator.SafeParse(formData);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, `Invalid form data: ${error.message}`);
  }
  const prebuild = await db.prebuildEvent.findUnique({
    where: { externalId: prebuildInfo.prebuildExternalId },
  });
  if (prebuild == null) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Prebuild not found");
  }

  await withClient(async (client) => {
    const handle = client.workflow.getHandle(prebuild.workflowId);
    await handle.cancel();
    await handle.result().catch(() => {
      // Ignore
    });
  });

  return redirect(getPrebuildPath(prebuild.externalId));
};

export default function DefaultView() {
  return null;
}
