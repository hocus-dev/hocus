import type { WorkspaceStatus } from "@prisma/client";
import { useSearchParams } from "@remix-run/react";
import { Card, Button, Spinner } from "flowbite-react";
import { useEffect } from "react";
import { WorkspacePathParams } from "~/page-paths.shared";
import { unwrap } from "~/utils.shared";
import { createVSCodeURI } from "~/workspace/utils";
import type { WorkspaceInfo } from "~/workspace/workspace.service";

import { DeleteWorkspaceButton } from "./delete-workspace-btn";
import { StartWorkspaceButton } from "./start-workspace-btn";
import { StopWorkspaceButton } from "./stop-workspace-btn";
import { WorkspaceStatusComponent } from "./workspace-status";

export function WorkspaceStatusCard(props: { workspace: WorkspaceInfo }): JSX.Element {
  const { workspace } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const justStarted = searchParams.get(WorkspacePathParams.JUST_STARTED) != null;
  const justStopped = searchParams.get(WorkspacePathParams.JUST_STOPPED) != null;
  const justDeleted = searchParams.get(WorkspacePathParams.JUST_DELETED) != null;
  let status = workspace.status;
  if (justStarted && workspace.status === "WORKSPACE_STATUS_STOPPED") {
    status = "WORKSPACE_STATUS_PENDING_START";
  } else if (justStopped && workspace.status === "WORKSPACE_STATUS_STARTED") {
    status = "WORKSPACE_STATUS_PENDING_STOP";
  } else if (justDeleted && workspace.status === "WORKSPACE_STATUS_STOPPED") {
    status = "WORKSPACE_STATUS_PENDING_DELETE";
  }

  const vsCodeUri =
    workspace.status === "WORKSPACE_STATUS_STARTED"
      ? createVSCodeURI({
          agentHostname: workspace.agentHostname,
          // if the workspace is started, the workspaceHostname is guaranteed to be defined
          workspaceHostname: unwrap(workspace.workspaceHostname),
          workspaceName: workspace.name.toLowerCase().replace(" ", "-"),
          workspaceRoot: workspace.project.rootDirectoryPath,
        })
      : "";
  useEffect(() => {
    if (justStarted && workspace.status === "WORKSPACE_STATUS_STARTED") {
      searchParams.delete(WorkspacePathParams.JUST_STARTED);
      setSearchParams(searchParams, { replace: true });
    }
  });
  useEffect(() => {
    if (
      searchParams.get(WorkspacePathParams.SHOULD_OPEN) != null &&
      workspace.status === "WORKSPACE_STATUS_STARTED"
    ) {
      window.open(vsCodeUri, "_self", "noreferrer");

      // MUST BE AFTER window.open
      // Otherwise remix crashes on firefox but not chrome!!!
      // I have no idea why but it took me some time to figure it out
      searchParams.delete(WorkspacePathParams.SHOULD_OPEN);
      setSearchParams(searchParams, { replace: true });
    }
  });
  useEffect(() => {
    if (justStopped && workspace.status === "WORKSPACE_STATUS_STOPPED") {
      searchParams.delete(WorkspacePathParams.JUST_STOPPED);
      setSearchParams(searchParams, { replace: true });
    }
  });

  const spinnerColor: Record<WorkspaceStatus, string> = {
    WORKSPACE_STATUS_PENDING_CREATE: "warning",
    WORKSPACE_STATUS_PENDING_START: "info",
    WORKSPACE_STATUS_PENDING_STOP: "warning",
    WORKSPACE_STATUS_STARTED: "success",
    WORKSPACE_STATUS_STOPPED: "gray",
    WORKSPACE_STATUS_PENDING_DELETE: "gray",
  };
  const spinner = (
    <div className="w-full flex justify-center mt-10">
      <Spinner size="lg" color={spinnerColor[status]} />
    </div>
  );
  const lowerPartByStatus: Record<WorkspaceStatus, JSX.Element> = {
    WORKSPACE_STATUS_STARTED: (
      <>
        <div className="text-sm text-gray-400 text-center mt-6">
          <p>VSCode should open automatically.</p>
          <p>If it does not, click the button below.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <StopWorkspaceButton workspaceExternalId={workspace.externalId} className={"w-full"} />
          <a href={vsCodeUri} target="_self" rel="noreferrer">
            <Button className="w-full" color="success">
              <i className="fa-solid fa-code mr-2"></i>
              <span>Open in VSCode</span>
            </Button>
          </a>
        </div>
      </>
    ),
    WORKSPACE_STATUS_STOPPED: (
      <div className="grid grid-cols-2 gap-4 mt-10">
        <DeleteWorkspaceButton
          workspaceExternalId={workspace.externalId}
          workspaceName={workspace.name}
        />
        <StartWorkspaceButton workspaceExternalId={workspace.externalId} className={"w-full"} />
      </div>
    ),
    WORKSPACE_STATUS_PENDING_CREATE: spinner,
    WORKSPACE_STATUS_PENDING_START: spinner,
    WORKSPACE_STATUS_PENDING_STOP: spinner,
    WORKSPACE_STATUS_PENDING_DELETE: spinner,
  };
  return (
    <Card className="w-[28rem] max-w-xl">
      <div>
        <h2 className="text-center text-md text-gray-400 mb-4">
          <WorkspaceStatusComponent status={status} />
        </h2>
        <h2 className="text-center text-md text-gray-400">Workspace</h2>
        <h1 className="text-center text-xl font-bold">{workspace.name}</h1>
        <div className="flex flex-col mt-8 gap-2">
          {[
            ["Project:", workspace.project.name],
            ["Based on branch:", workspace.branchName],
            ["Based on commit:", workspace.commitHash.substring(0, 7)],
            ["Last opened at:", new Date(workspace.lastOpenedAt).toLocaleString()],
            ["Created at:", new Date(workspace.createdAt).toLocaleString()],
          ].map(([title, content], idx) => (
            <div key={idx} className="grid grid-cols-2">
              <div className="text-gray-400">{title}</div>
              <div className="text-right font-bold">{content}</div>
            </div>
          ))}
        </div>
        {lowerPartByStatus[status]}
      </div>
    </Card>
  );
}
