import { Tooltip } from "flowbite-react";
import { getPrebuildPath } from "~/page-paths.shared";
import { unwrap } from "~/utils.shared";

import { NewWorkspaceButton } from "./new-workspace-btn";

export const NewWorkspaceBranchListElement = (props: {
  branch: {
    name: string;
    externalId: string;
  };
  ongoingPrebuild: {
    externalId: string;
  } | null;
  finishedPrebuild: {
    externalId: string;
    commitHash: string;
  } | null;
}): JSX.Element => {
  const isOngoingAndFinished = props.ongoingPrebuild != null && props.finishedPrebuild != null;
  const isOngoingButNotFinished = props.ongoingPrebuild != null && props.finishedPrebuild == null;
  const tooltipText = isOngoingAndFinished
    ? `The latest available prebuild is for commit ${unwrap(
        props.finishedPrebuild,
      ).commitHash.substring(0, 8)}. You may open it or wait for a newer one to finish.`
    : null;
  const btnText = props.ongoingPrebuild != null ? "Open old" : "Open";
  const ongoingPrebuildText = props.ongoingPrebuild && (
    <a href={getPrebuildPath(props.ongoingPrebuild.externalId)} target="_blank noreferrer">
      <p className="text-xs hover:text-gray-200 hover:underline">
        {isOngoingAndFinished && <i className="fa-solid fa-circle-info mr-2"></i>}
        <span>Ongoing prebuild...</span>
      </p>
    </a>
  );

  return (
    <div className="border-t border-gray-700 p-2 text-gray-400 last:border-b flex items-center justify-between gap-4">
      <p>{props.branch.name}</p>
      <div className="flex items-center gap-4">
        {isOngoingAndFinished && (
          <Tooltip
            theme={{ target: "h-full" }}
            className="drop-shadow max-w-[14rem]"
            placement="top"
            content={tooltipText}
          >
            {ongoingPrebuildText}
          </Tooltip>
        )}
        {isOngoingButNotFinished && ongoingPrebuildText}
        {props.finishedPrebuild && (
          <NewWorkspaceButton
            externalGitBranchId={props.branch.externalId}
            externalPrebuildEventId={props.finishedPrebuild.externalId}
            btnSize="sm"
            content={
              <>
                <i className="fa-solid fa-circle-plus mr-2"></i>
                <span>{btnText}</span>
              </>
            }
          />
        )}
      </div>
    </div>
  );
};
