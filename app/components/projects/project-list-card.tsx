import { Button, Card } from "flowbite-react";
import moment from "moment";
import React from "react";

import { getProjectPath } from "~/page-paths.shared";

export interface ProjectListCardProps {
  externalId: string;
  name: string;
  repositoryUrl: string;
  /**
   * Timestamp in milliseconds.
   */
  createdAt: number;
}

function ProjectListCardComponent(props: ProjectListCardProps): JSX.Element {
  const createdAt = moment(props.createdAt).fromNow();
  const projectPath = getProjectPath(props.externalId);

  return (
    <a
      href={projectPath}
      className="hover:drop-shadow-xl hover:scale-[1.03] active:scale-[0.99] transition-all"
    >
      <Card key={props.externalId}>
        <h3 className="text-lg font-extrabold text-wrap">{props.name}</h3>
        <h4 className="text-gray-400 truncate">
          <i className="fa-solid fa-link mr-2 text-xs"></i>
          <span>{props.repositoryUrl}</span>
        </h4>
        <div className="flex w-full justify-between items-end">
          <p className="text-gray-400 text-sm">
            <i className="fa-solid fa-clock text-xs mr-2"></i>
            <span>Created {createdAt}</span>
          </p>
          <Button tabIndex={-1} color={"dark"} outline={true} size={"xs"}>
            <span className="text-sm flex flex-nowrap items-center">
              <i className="fa-solid fa-folder-open mr-2"></i>
              <span>Open</span>
            </span>
          </Button>
        </div>
      </Card>
    </a>
  );
}

export const ProjectListCard = React.memo(ProjectListCardComponent);
