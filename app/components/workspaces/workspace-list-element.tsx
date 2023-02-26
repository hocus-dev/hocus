import type { WorkspaceStatus } from "@prisma/client";
import { Button } from "flowbite-react";
import moment from "moment";

import { StartWorkspaceButton } from "./start-workspace-btn";
import { WorkspaceStatusComponent } from "./workspace-status";

export interface WorkspaceListElementProps {
  externalId: string;
  name: string;
  /** Timestamp in milliseconds. */
  lastOpenedAt: number;
  /** Timestamp in milliseconds. */
  createdAt: number;
  status: WorkspaceStatus;
  branchName: string;
  commitHash: string;
  workspaceHostname?: string;
  agentHostname: string;
}

export function WorkspaceListElement(props: WorkspaceListElementProps): JSX.Element {
  const created = moment(props.createdAt).fromNow();
  const lastOpened = moment(props.lastOpenedAt).fromNow();
  const commitHash = props.commitHash.substring(0, 8);
  const showOpenButton = props.status === "WORKSPACE_STATUS_STARTED";
  const showStopButton = props.status === "WORKSPACE_STATUS_STARTED";
  const showStartButton = props.status === "WORKSPACE_STATUS_STOPPED";

  return (
    <div className="w-full flex justify-between pb-4 pt-4 first:pt-0 first:-mt-1 border-gray-700 border-b-[1px]">
      <div>
        <h3 className="font-bold mb-4 text-lg">{props.name}</h3>
        <div className="grid grid-cols-2 grid-rows-2 gap-4 mr-4">
          {[
            ["Base Branch", props.branchName],
            ["Base Commit", commitHash],
            ["Created", created],
            ["Last Opened", lastOpened],
          ].map(([title, content], idx) => (
            <p key={idx} className="text-gray-400">
              <span>{title}: </span>
              <span className="font-bold text-white">{content}</span>
            </p>
          ))}
          <p className="text-gray-400">
            <span className="mr-1">Status: </span>
            <WorkspaceStatusComponent status={props.status} />
          </p>
          <p className="text-gray-400">
            <span className="mr-1">Id: </span>
            <span className="font-bold">{props.externalId}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <div className="flex gap-4">
          <Button color="light" className="transition-all">
            <i className="fa-solid fa-circle-info mr-2"></i>
            <span>Details</span>
          </Button>
          {showOpenButton && (
            <Button
              href={`vscode://hocus.hocus/?agent-hostname=${props.agentHostname}&workspace-hostname=${props.workspaceHostname}`}
              color="success"
              className="transition-all"
            >
              <i className="fa-solid fa-circle-play mr-2"></i>
              <span>Open</span>
            </Button>
          )}
          {showStopButton && (
            <Button color="dark" className="transition-all">
              <i className="fa-solid fa-circle-stop mr-2"></i>
              <span>Stop</span>
            </Button>
          )}
          {showStartButton && <StartWorkspaceButton workspaceExternalId={props.externalId} />}
        </div>
      </div>
    </div>
  );
}
