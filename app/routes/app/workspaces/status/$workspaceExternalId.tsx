import path from "path";

import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";

import { HttpError } from "~/http-error.server";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";
import type { WorkspaceInfo } from "~/workspace/workspace.service";

export interface WorkspaceRouteLoaderData {
  workspace: WorkspaceInfo | null;
}

export const loader = async ({ context: { db, req, user, app } }: LoaderArgs) => {
  const { success, value: workspaceExternalId } = UuidValidator.SafeParse(
    path.parse(req.params[0]).name,
  );
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Workspace id must be a UUID");
  }
  const workspaceService = app.resolve(Token.WorkspaceService);
  const workspace = await workspaceService.getWorkspaceInfo(
    db,
    unwrap(user).id,
    workspaceExternalId,
  );
  const result: WorkspaceRouteLoaderData = { workspace };
  return json(result);
};
