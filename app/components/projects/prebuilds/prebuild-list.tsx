import type { PrebuildListElementProps } from "./prebuild-list-element";
import { PrebuildListElement } from "./prebuild-list-element";

export function PrebuildList(props: { elements: PrebuildListElementProps[] }): JSX.Element {
  const noElementsView = (
    <div className="flex flex-col items-center justify-center h-full mt-16">
      <i className="fa-solid fa-ship text-5xl text-gray-400"></i>
      <p className="text-gray-400 mt-4">
        No prebuilds yet. It usually takes a minute after a project is added before the first
        prebuild is automatically started.
      </p>
    </div>
  );
  return (
    <div className="grid grid-cols-1">
      {props.elements.length === 0 && noElementsView}
      {props.elements.map((element, idx) => (
        <PrebuildListElement {...element} key={idx} />
      ))}
    </div>
  );
}
