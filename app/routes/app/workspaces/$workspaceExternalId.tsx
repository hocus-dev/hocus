import path from "path";

import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { StatusCodes } from "http-status-codes";
import { AppPage } from "~/components/app-page";
import { WorkspaceStatusCard } from "~/components/workspaces/workspace-status-card";
import { HttpError } from "~/http-error.server";
import { getProjectPath } from "~/page-paths.shared";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { unwrap } from "~/utils.shared";

export const loader = async ({ context: { db, req, user } }: LoaderArgs) => {
  const { success, value: workspaceExternalId } = UuidValidator.SafeParse(
    path.parse(req.params[0]).name,
  );
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Workspace id must be a UUID");
  }
  const workspace = await db.workspace.findUnique({
    where: { externalId: workspaceExternalId },
    include: {
      prebuildEvent: {
        include: { project: true },
      },
    },
  });
  if (workspace == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Workspace not found");
  }
  if (workspace.userId !== unwrap(user).id) {
    throw new HttpError(StatusCodes.FORBIDDEN, "Workspace does not belong to user");
  }

  return json({
    workspace: {
      status: workspace.status,
      name: workspace.name,
      project: {
        externalId: workspace.prebuildEvent.project.externalId,
        name: workspace.prebuildEvent.project.name,
      },
    },
  });
};

export default function ProjectRoute(): JSX.Element {
  const { workspace } = useLoaderData<typeof loader>();

  return (
    <AppPage>
      <div className="mt-8 mb-4">
        <a
          href={getProjectPath(workspace.project.externalId)}
          className="text-sm text-gray-400 hover:text-gray-300 transition-all"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>
          <span>Back to project "{workspace.project.name}"</span>
        </a>
      </div>
      <div className="h-full flex flex-col justify-center items-center">
        <WorkspaceStatusCard justCreated={true} workspace={workspace} />
      </div>
    </AppPage>
  );
}
