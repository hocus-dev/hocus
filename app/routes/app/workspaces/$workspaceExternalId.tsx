import path from "path";

import type { WorkspaceStatus } from "@prisma/client";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { StatusCodes } from "http-status-codes";
import { useEffect, useState } from "react";
import { AppPage } from "~/components/app-page";
import { WorkspaceStatusCard } from "~/components/workspaces/workspace-status-card";
import { WorkspaceStatusCardPlaceholder } from "~/components/workspaces/workspace-status-card-placeholder";
import { HttpError } from "~/http-error.server";
import { getProjectPath, getWorkspaceStatusPath } from "~/page-paths.shared";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { Token } from "~/token";
import { max, sleep, unwrap } from "~/utils.shared";

import type { WorkspaceRouteLoaderData } from "./status/$workspaceExternalId";

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
  const justCreated = req.query.justCreated != null;
  if (workspace == null && justCreated) {
    return json({ workspaceExternalId, workspace: null });
  }
  if (workspace == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Workspace not found");
  }
  return json({
    workspaceExternalId,
    workspace,
  });
};

export default function ProjectRoute(): JSX.Element {
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [fetchLoopStarted, setFetchLoopStarted] = useState(false);
  const [fetchedData, setFetchedData] = useState<WorkspaceRouteLoaderData | undefined>(void 0);
  useEffect(() => {
    const innerfn = async () => {
      const intervalsMs: Record<WorkspaceStatus, number> = {
        WORKSPACE_STATUS_PENDING_CREATE: 1000,
        WORKSPACE_STATUS_PENDING_START: 1000,
        WORKSPACE_STATUS_PENDING_STOP: 1000,
        WORKSPACE_STATUS_STARTED: 10000,
        WORKSPACE_STATUS_STOPPED: 1000,
      };
      let lastFetchAt = 0;
      let intervalMs = 1000;
      while (true) {
        try {
          lastFetchAt = Date.now();
          const data: WorkspaceRouteLoaderData = await fetch(
            getWorkspaceStatusPath(loaderData.workspaceExternalId),
            {
              credentials: "same-origin",
            },
          ).then((r) => r.json());
          setFetchedData(data);
          intervalMs = intervalsMs[data.workspace?.status ?? "WORKSPACE_STATUS_PENDING_CREATE"];
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
        }
        const msUntilNextFetch = max(0, intervalMs - (Date.now() - lastFetchAt));
        await sleep(msUntilNextFetch);
      }
    };
    if (!fetchLoopStarted) {
      setFetchLoopStarted(true);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      innerfn();
    }
  }, [loaderData, setFetchedData, fetchLoopStarted, setFetchLoopStarted]);
  const justStarted = searchParams.get("justStarted") != null;
  const workspace = fetchedData?.workspace ?? loaderData.workspace;

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
        <WorkspaceStatusCard justStarted={justStarted} workspace={workspace} />
      </div>
    </AppPage>
  );
}