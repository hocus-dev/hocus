import { Button } from "flowbite-react";
import moment from "moment";
import React, { useState } from "react";
import type { Any } from "ts-toolbelt";
import {
  PagePaths,
  ProjectPathTabId,
  getNewWorkspacePath,
  getProjectPath,
} from "~/page-paths.shared";

import { AppPage } from "../app-page";

import { RepoSshKeyCard } from "./repo-ssh-key-card";

const PROJECT_TAB_TITLES: Record<ProjectPathTabId, React.ReactNode> = {
  [ProjectPathTabId.WORKSPACES]: (
    <>
      <i className="fa-solid fa-laptop-code mr-2"></i>
      <span className="font-bold">Workspaces</span>
    </>
  ),
  [ProjectPathTabId.PREBUILDS]: (
    <>
      <i className="fa-solid fa-list-check mr-2"></i>
      <span className="font-bold">Prebuilds</span>
    </>
  ),
  [ProjectPathTabId.ENVIRONMENT]: (
    <>
      <i className="fa-solid fa-terminal mr-2"></i>
      <span className="font-bold">Environment</span>
    </>
  ),
  [ProjectPathTabId.SETTINGS]: (
    <>
      <i className="fa-solid fa-gear mr-2"></i>
      <span className="font-bold">Settings</span>
    </>
  ),
};

const PROJECT_TAB_ORDER = [
  ProjectPathTabId.WORKSPACES,
  ProjectPathTabId.PREBUILDS,
  ProjectPathTabId.ENVIRONMENT,
  ProjectPathTabId.SETTINGS,
] as const;
// enforces that PROJECT_TAB_ORDER contains all values of ProjectPathTabId
const _typecheck: Any.Equals<typeof PROJECT_TAB_ORDER[number], ProjectPathTabId> = 1;

function ProjectPageComponent(props: {
  project: { name: string; externalId: string; createdAt: number };
  gitRepository: { url: string; publicKey: string };
  activeTab: ProjectPathTabId;
  content: React.ReactNode;
}): JSX.Element {
  const { project, gitRepository } = props;
  const createdAt = moment(project.createdAt).fromNow();
  const [showPublicKey, setShowPublicKey] = useState(false);
  const toggleShowPublicKey = React.useCallback(() => setShowPublicKey((v) => !v), []);
  return (
    <AppPage>
      <div className="mt-8 mb-4">
        <a
          href={PagePaths.ProjectList}
          className="text-sm text-gray-400 hover:text-gray-300 transition-all"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>
          <span>Back to Project List</span>
        </a>
      </div>
      <div className="mb-8 flex justify-between items-end">
        <h1 className="text-4xl font-bold">{project.name}</h1>
        <Button
          href={getNewWorkspacePath({ projectExternalId: project.externalId })}
          color="success"
          className="transition-all"
        >
          <i className="fa-solid fa-circle-plus mr-2"></i>
          <span>New Workspace</span>
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <p>
          <span className="text-gray-400">
            <i className="w-6 fa-solid fa-link mr-2"></i>
            <span>Repository URL: </span>
          </span>
          <span className="font-bold">{gitRepository.url}</span>
        </p>
        <p className="flex items-center gap-2">
          <span className="text-gray-400">
            <i className="w-6 fa-solid fa-key mr-2"></i>
            <span>Public Key for Git: </span>
          </span>
          <Button onClick={toggleShowPublicKey} color="dark" size="xs">
            {showPublicKey ? (
              <>
                <i className="fa-solid fa-eye-slash mr-2"></i>
                <span>Hide</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-eye mr-2"></i>
                <span>Show</span>
              </>
            )}
          </Button>
        </p>
        <p>
          <span className="text-gray-400">
            <i className="w-6 fa-solid fa-clock mr-2"></i>
            <span>Created: </span>
          </span>
          <span className="font-bold">{createdAt}</span>
        </p>
        {showPublicKey && (
          <>
            <div className="mb-2"></div>
            <RepoSshKeyCard publicKey={gitRepository.publicKey} />
          </>
        )}
      </div>
      <div className="mt-8 text-sm font-bold text-center text-gray-500 border-b border-gray-200 dark:text-gray-400 dark:border-gray-700">
        <ul className="flex flex-wrap -mb-px">
          {PROJECT_TAB_ORDER.map((tabId) => {
            const isActive = tabId === props.activeTab;
            const activeClasses =
              "inline-block p-4 text-blue-600 border-b-2 border-blue-600 rounded-t-lg active dark:text-blue-500 dark:border-blue-500";
            const inactiveClasses =
              "inline-block p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300";
            return (
              <li key={tabId}>
                <a
                  href={getProjectPath(project.externalId, tabId)}
                  className={isActive ? activeClasses : inactiveClasses}
                >
                  {PROJECT_TAB_TITLES[tabId]}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-2 p-4">{props.content}</div>
    </AppPage>
  );
}

export const ProjectPage = React.memo(ProjectPageComponent);
