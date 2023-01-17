import { Button, Card } from "flowbite-react";
import moment from "moment";
import React from "react";

export interface ProjectListCardProps {
  externalId: string;
  name: string;
  repositoryUrl: string;
  /**
   * Timestamp in milliseconds.
   */
  lastUpdatedAt: number;
}

function ProjectListCardComponent(props: ProjectListCardProps): JSX.Element {
  const lastUpdatedAt = moment(props.lastUpdatedAt).fromNow();
  return (
    <a href="/xd" className="hover:drop-shadow-xl hover:scale-[1.03] transition-all">
      <Card key={props.externalId}>
        <h3 className="text-lg font-extrabold">{props.name}</h3>
        <h4 className="text-gray-200">{props.repositoryUrl}</h4>
        <div className="flex w-full justify-between items-end">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Last updated {lastUpdatedAt}</p>
          <Button color={"dark"} outline={true} size={"xs"}>
            <span className="text-sm">Open</span>
          </Button>
        </div>
      </Card>
    </a>
  );
}

export const ProjectListCard = React.memo(ProjectListCardComponent);
