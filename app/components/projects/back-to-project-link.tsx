import type { ProjectPathTabId } from "~/page-paths.shared";
import { getProjectPath } from "~/page-paths.shared";

export const BackToProjectLink = (props: {
  project: { name: string; externalId: string };
  tabId?: ProjectPathTabId;
}): JSX.Element => {
  return (
    <div className="mt-8 mb-4">
      <a
        href={getProjectPath(props.project.externalId, props.tabId)}
        className="text-sm text-gray-400 hover:text-gray-300 transition-all"
      >
        <i className="fa-solid fa-arrow-left mr-2"></i>
        <span>Back to Project "{props.project.name}"</span>
      </a>
    </div>
  );
};
