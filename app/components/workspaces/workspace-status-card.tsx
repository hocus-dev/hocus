import type { WorkspaceStatus } from "@prisma/client";
import { Card, Button, Spinner } from "flowbite-react";

export function WorkspaceStatusCard(props: {
  justCreated: boolean;
  workspace: { status: WorkspaceStatus; name: string };
}): JSX.Element {
  const { workspace } = props;
  const variants: Record<WorkspaceStatus, JSX.Element> = {
    WORKSPACE_STATUS_STARTED: <div></div>,
    WORKSPACE_STATUS_STOPPED: (
      <div>
        <h2 className="text-center text-md text-gray-400 mb-4">Workspace Stopped</h2>
        <h1 className="text-center text-xl font-bold">{workspace.name}</h1>
        <div className="flex flex-col mt-8 gap-2">
          {[
            ["Project:", "Hocus Tests"],
            ["Based on branch:", "main"],
            ["Based on commit", "73h28d9"],
          ].map(([title, content], idx) => (
            <div key={idx} className="grid grid-cols-2">
              <div className="text-gray-400">{title}</div>
              <div className="text-right font-bold">{content}</div>
            </div>
          ))}
        </div>
        {props.justCreated ? (
          <div className="w-full flex justify-center mt-10">
            <Spinner size="lg" color="success" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mt-10">
            <Button color="light">Details</Button>
            <Button color="success">Open</Button>
          </div>
        )}
      </div>
    ),
    WORKSPACE_STATUS_PENDING_CREATE: <div></div>,
    WORKSPACE_STATUS_PENDING_START: <div></div>,
    WORKSPACE_STATUS_PENDING_STOP: <div></div>,
  };
  return <Card className="w-[28rem] max-w-xl">{variants[workspace.status]}</Card>;
}
