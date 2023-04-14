import { Tooltip } from "flowbite-react";
import React from "react";

import type { GitRepoConnectionStatus } from "~/git/types.shared";

function GitRepoConnectionStatusBadgeComponent(props: {
  status: GitRepoConnectionStatus;
}): JSX.Element {
  const status = props.status;
  const isConnected = status.status === "connected";
  let tooltipText: React.ReactNode = "";
  if (status.status === "connected") {
    tooltipText = `Last connected at ${new Date(status.lastConnectedAt).toLocaleString()}`;
  } else {
    const error = status.error;

    if (error == null) {
      tooltipText = `Refresh the page to see if connection was established.`;
    } else {
      tooltipText = (
        <>
          <p>{`Last connection attempt at ${new Date(error.occurredAt).toLocaleString()}`}</p>
          <p className="mt-2">Error:</p>
          <p className="font-mono mt-2">{error.message}</p>
        </>
      );
    }
  }
  const tooltipContent = <div className="text-xs max-w-[40rem]">{tooltipText}</div>;
  return (
    <Tooltip content={tooltipContent}>
      <div className="flex items-center">
        {isConnected ? (
          <span>
            <i className="fa-solid fa-circle-check text-green-400 text-md"></i>
          </span>
        ) : (
          <div className="flex items-center text-gray-400 font-bold w-fit h-fit gap-1 text-xs border px-2 p-1 rounded border-gray-700">
            <i className="fa-solid fa-triangle-exclamation mr-1"></i>
            <span>Disconnected</span>
          </div>
        )}
      </div>
    </Tooltip>
  );
}

export const GitRepoConnectionStatusBadge = React.memo(GitRepoConnectionStatusBadgeComponent);
