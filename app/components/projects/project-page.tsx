import type { TabsRef } from "flowbite-react";
import { Button, Tabs } from "flowbite-react";
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
};

const PROJECT_TAB_ORDER = [
  ProjectPathTabId.WORKSPACES,
  ProjectPathTabId.PREBUILDS,
  ProjectPathTabId.ENVIRONMENT,
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
  const tabsRef = React.useRef<TabsRef>(null);
  const onActiveTabChange = React.useCallback(
    (tabIdx: number) => {
      const tabId = PROJECT_TAB_ORDER[tabIdx];
      window.location.href = getProjectPath(project.externalId, tabId);
      // we don't want to actually change the tab - we just want to change the URL
      tabsRef.current?.setActiveTab(PROJECT_TAB_ORDER.indexOf(props.activeTab));
    },
    [project.externalId, props.activeTab],
  );
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
      <Tabs.Group
        aria-label="Tabs with icons"
        /* eslint-disable-next-line react/style-prop-object */
        style="underline"
        className="mt-4"
        onActiveTabChange={onActiveTabChange}
        ref={tabsRef}
      >
        {PROJECT_TAB_ORDER.map((tabId) => {
          const title = PROJECT_TAB_TITLES[tabId];
          const tabActive = props.activeTab === tabId;
          return (
            <Tabs.Item key={tabId} active={tabActive} title={title}>
              {tabActive && props.content}
            </Tabs.Item>
          );
        })}
      </Tabs.Group>
    </AppPage>
  );
}

export const ProjectPage = React.memo(ProjectPageComponent);
