import React from "react";

import type { ProjectListCardProps } from "./project-list-card";
import { ProjectListCard } from "./project-list-card";

function ProjectListComponent(props: { elements: ProjectListCardProps[] }): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {props.elements.map((e) => (
        <ProjectListCard key={e.externalId} {...e} />
      ))}
    </div>
  );
}

export const ProjectList = React.memo(ProjectListComponent);
