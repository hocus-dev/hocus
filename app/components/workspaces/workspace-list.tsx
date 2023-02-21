import type { WorkspaceListElementProps } from "./workspace-list-element";
import { WorkspaceListElement } from "./workspace-list-element";

export function WorkspaceList(props: { elements: WorkspaceListElementProps[] }): JSX.Element {
  const noElementsView = (
    <div className="flex flex-col items-center justify-center h-full mt-16">
      <i className="fa-solid fa-ship text-5xl text-gray-400"></i>
      <p className="text-gray-400 mt-4">
        No Workspaces yet. Push a commit to the repository to start one.
      </p>
    </div>
  );
  return (
    <div className="grid grid-cols-1">
      {props.elements.length === 0 && noElementsView}
      {props.elements.map((element, idx) => (
        <WorkspaceListElement {...element} key={idx} />
      ))}
    </div>
  );
}
