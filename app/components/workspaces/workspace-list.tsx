import type { WorkspaceListElementProps } from "./workspace-list-element";
import { WorkspaceListElement } from "./workspace-list-element";

export function WorkspaceList(props: { elements: WorkspaceListElementProps[] }): JSX.Element {
  const noElementsView = (
    <div className="flex flex-col items-center justify-center h-full mt-16">
      <i className="fa-solid fa-broom-ball text-5xl text-gray-400"></i>
      <p className="text-gray-400 mt-4">No workspaces yet.</p>
    </div>
  );
  return (
    <div className="grid grid-cols-1">
      {props.elements.length === 0 && noElementsView}
      {props.elements.map((element, idx) => (
        <WorkspaceListElement {...element} key={idx} />
      ))}
      {props.elements.length > 0 && (
        <div className="mt-8 text-center text-gray-400 text-sm">
          <i className="fa-solid fa-circle-info mr-2"></i>
          <span>Only your workspaces are listed here.</span>
        </div>
      )}
    </div>
  );
}
