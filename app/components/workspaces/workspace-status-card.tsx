import type { WorkspaceStatus } from "@prisma/client";
import { Card, Button, Spinner } from "flowbite-react";

import { WorkspaceStatusComponent } from "./workspace-status";

export function WorkspaceStatusCard(props: {
  justStarted: boolean;
  workspace: {
    status: WorkspaceStatus;
    name: string;
    project: {
      name: string;
    };
    branchName: string;
    commitHash: string;
  };
}): JSX.Element {
  const { workspace } = props;
  const status =
    props.justStarted && workspace.status === "WORKSPACE_STATUS_STOPPED"
      ? "WORKSPACE_STATUS_PENDING_START"
      : workspace.status;

  const spinnerColor: Record<WorkspaceStatus, string> = {
    WORKSPACE_STATUS_PENDING_CREATE: "warning",
    WORKSPACE_STATUS_PENDING_START: "info",
    WORKSPACE_STATUS_PENDING_STOP: "warning",
    WORKSPACE_STATUS_STARTED: "success",
    WORKSPACE_STATUS_STOPPED: "gray",
  };
  const spinner = (
    <div className="w-full flex justify-center mt-10">
      <Spinner size="lg" color={spinnerColor[status]} />
    </div>
  );
  const lowerPart: Record<WorkspaceStatus, JSX.Element> = {
    WORKSPACE_STATUS_STARTED: (
      <>
        <div className="text-sm text-gray-400 text-center mt-6">
          <p>VSCode should open automatically.</p>
          <p>If it does not, click the button below.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Button color="light">Details</Button>
          <Button color="success">Open in VSCode</Button>
        </div>
      </>
    ),
    WORKSPACE_STATUS_STOPPED: (
      <div className="grid grid-cols-2 gap-4 mt-10">
        <Button color="light">Details</Button>
        <Button color="success">Open</Button>
      </div>
    ),
    WORKSPACE_STATUS_PENDING_CREATE: spinner,
    WORKSPACE_STATUS_PENDING_START: spinner,
    WORKSPACE_STATUS_PENDING_STOP: spinner,
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
          ].map(([title, content], idx) => (
            <div key={idx} className="grid grid-cols-2">
              <div className="text-gray-400">{title}</div>
              <div className="text-right font-bold">{content}</div>
            </div>
          ))}
        </div>
        {lowerPart[status]}
      </div>
    </Card>
  );
}
