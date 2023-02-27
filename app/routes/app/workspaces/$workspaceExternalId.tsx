import path from "path";

import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { StatusCodes } from "http-status-codes";
import { AppPage } from "~/components/app-page";
import { WorkspaceStatusCard } from "~/components/workspaces/workspace-status-card";
import { WorkspaceStatusCardPlaceholder } from "~/components/workspaces/workspace-status-card-placeholder";
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
        include: { project: true, gitObject: true },
      },
      gitBranch: true,
    },
  });
  const justCreated = req.query.justCreated != null;
  if (workspace == null && justCreated) {
    return json({ workspace: null });
  }
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
      branchName: workspace.gitBranch.name,
      commitHash: workspace.prebuildEvent.gitObject.hash,
      project: {
        externalId: workspace.prebuildEvent.project.externalId,
        name: workspace.prebuildEvent.project.name,
      },
    },
  });
};

export default function ProjectRoute(): JSX.Element {
  const { workspace } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get("justCreated") != null;

  if (workspace == null) {
    return (
      <AppPage>
        <div className="mt-10 mb-4">
          <div className="flex justify-start">
            <div className="animate-pulse w-56 h-4 bg-gray-700 rounded"></div>
          </div>
        </div>
        <div className="h-full flex flex-col justify-center items-center">
          <WorkspaceStatusCardPlaceholder />
        </div>
      </AppPage>
    );
  }
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
        <WorkspaceStatusCard justCreated={justCreated} workspace={workspace} />
      </div>
    </AppPage>
  );
}
