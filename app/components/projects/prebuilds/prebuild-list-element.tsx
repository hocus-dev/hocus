import type { PrebuildEventStatus } from "@prisma/client";
import { Button } from "flowbite-react";
import moment from "moment";
import { NewWorkspaceButton } from "~/components/workspaces/new-workspace-btn";
import { getNewWorkspacePath, getPrebuildPath } from "~/page-paths.shared";

import { PrebuildStatus } from "./prebuild-status";

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
    <div className="w-full flex justify-between pb-4 pt-4 first:pt-0 first:-mt-1 border-gray-700 border-b-[1px]">
      <div className="grid grid-cols-2 grid-rows-2 gap-4 mr-4">
        <p className="text-gray-400">
          <span className="mr-1">Status: </span>
          <PrebuildStatus status={props.status} />
        </p>
        {[
          [branchesTitle, branches],
          ["Commit", props.commitHash],
          ["Created", created],
        ].map(([title, content], idx) => (
          <p key={idx} className="text-gray-400">
            <span>{title}: </span>
            <span className="font-bold text-white">{content}</span>
          </p>
        ))}
      </div>
      <div className="flex flex-col justify-center">
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
              className="transition-all"
            >
              <i className="fa-solid fa-circle-plus mr-2"></i>
              <span>New Workspace</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
