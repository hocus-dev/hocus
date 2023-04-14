import type { PrebuildEventStatus } from "@prisma/client";
import { Button } from "flowbite-react";
import moment from "moment";

import { PrebuildStatus } from "./prebuild-status";

import { NewWorkspaceButton } from "~/components/workspaces/new-workspace-btn";
import { getNewWorkspacePath, getPrebuildPath } from "~/page-paths.shared";

export interface PrebuildListElementProps {
  branches: {
    name: string;
    externalId: string;
  }[];
  commitHash: string;
  /* Timestamp in milliseconds. */
  createdAt: number;
  status: PrebuildEventStatus;
  externalPrebuildEventId: string;
}

export function PrebuildListElement(props: PrebuildListElementProps): JSX.Element {
  const created = moment(props.createdAt).fromNow();
  const showNewWorkspaceButton = props.status === "PREBUILD_EVENT_STATUS_SUCCESS";
  const branchesTitle = props.branches.length > 1 ? "Branches" : "Branch";
  const branches = props.branches.map((b) => b.name).join(", ");
  return (
    <>
      <div className={`flex flex-col justify-between gap-2`}>
        <p className="text-gray-400">
          <span className="mr-1">Status: </span>
          <PrebuildStatus status={props.status} />
        </p>
        <p className="text-gray-400">
          <span>Commit: </span>
          <span className="font-bold text-white">{props.commitHash}</span>
        </p>
      </div>
      <div className={`flex flex-col justify-between gap-2`}>
        <p className="text-gray-400">
          <span>{branchesTitle}: </span>
          <span className="font-bold text-white">{branches}</span>
        </p>
        <p className="text-gray-400">
          <span>Created: </span>
          <span className="font-bold text-white">{created}</span>
        </p>
      </div>
      <div className={`flex flex-col justify-center items-end`}>
        <div className="flex gap-4">
          <Button
            href={getPrebuildPath(props.externalPrebuildEventId)}
            color="light"
            className="transition-all"
          >
            <i className="fa-solid fa-circle-info mr-2"></i>
            <span>Details</span>
          </Button>
          {showNewWorkspaceButton && props.branches.length === 1 && (
            <NewWorkspaceButton
              externalGitBranchId={props.branches[0].externalId}
              externalPrebuildEventId={props.externalPrebuildEventId}
            />
          )}
          {showNewWorkspaceButton && props.branches.length > 1 && (
            <Button
              href={getNewWorkspacePath({ prebuildExternalId: props.externalPrebuildEventId })}
              type="submit"
              color="success"
              className="transition-all whitespace-nowrap"
            >
              <i className="fa-solid fa-circle-plus mr-2"></i>
              <span>New Workspace</span>
            </Button>
          )}
        </div>
      </div>
      <hr className="col-span-3 border-gray-700" />
    </>
  );
}
