import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "~/http-error.server";
import { getProjectPath, ProjectPathTabId } from "~/page-paths.shared";
import { parseEnvForm } from "~/project/env-form.shared";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export const action = async ({ context: { db, req, user, app } }: ActionArgs) => {
  const projectService = await app.resolve(Token.ProjectService);
  const formData = req.body;
  const { ok, error, data } = parseEnvForm(formData);
  if (!ok) {
    throw new HttpError(StatusCodes.BAD_REQUEST, error);
  }
  await db.$transaction(async (tdb) => {
    await projectService.updateEnvironmentVariables(tdb, {
      userId: unwrap(user).id,
      projectExternalId: data.projectId,
      target: data.target,
      update: data.update,
      delete: data.delete,
      create: data.create,
    });
  });
  return redirect(getProjectPath(data.projectId, ProjectPathTabId.ENVIRONMENT));
};

export default function EditEnv() {
  // this function exists because otherwise an error page
  // would not be rendered if the action threw
  return null;
}
