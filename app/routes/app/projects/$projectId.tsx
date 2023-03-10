import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import type { TabsRef } from "flowbite-react";
import { Button, Tabs } from "flowbite-react";
import { StatusCodes } from "http-status-codes";
import moment from "moment";
import path from "path-browserify";
import React from "react";
import { useRef, useState } from "react";
import { AppPage } from "~/components/app-page";
import { EnvironmentTab } from "~/components/environment/environment-tab";
import { PrebuildList } from "~/components/projects/prebuilds/prebuild-list";
import { RepoSshKeyCard } from "~/components/projects/repo-ssh-key-card";
import { WorkspaceList } from "~/components/workspaces/workspace-list";
import { HttpError } from "~/http-error.server";
import { getNewWorkspacePath, PagePaths, ProjectPathTabId } from "~/page-paths.shared";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export const loader = async ({ context: { db, req, user, app } }: LoaderArgs) => {
  const { success, value: projectExternalId } = UuidValidator.SafeParse(
    path.parse(req.params[0]).name,
  );
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Project id must be a UUID");
  }
  const config = await app.resolve(Token.Config).controlPlane();
  const project = await db.project.findUnique({
    where: { externalId: projectExternalId },
    include: {
      gitRepository: {
        include: {
          sshKeyPair: {
            select: {
              publicKey: true,
            },
          },
        },
      },
      environmentVariableSet: {
        include: {
          environmentVariables: {
            orderBy: { name: "asc" },
          },
        },
      },
      prebuildEvents: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          gitObject: true,
          gitBranchLinks: {
            include: { gitBranch: true },
          },
          workspaces: {
            where: { userId: unwrap(user).id },
            orderBy: { createdAt: "desc" },
            include: {
              gitBranch: true,
              prebuildEvent: { include: { gitObject: true } },
              agentInstance: true,
              activeInstance: true,
            },
          },
        },
      },
    },
  });
  if (project == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Project not found");
  }
  const userVariableSet = await db.userProjectEnvironmentVariableSet.findUnique({
    // eslint-disable-next-line camelcase
    where: { userId_projectId: { userId: unwrap(user).id, projectId: project.id } },
    include: {
      environmentSet: {
        include: {
          environmentVariables: {
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });
  const userVariables =
    userVariableSet?.environmentSet.environmentVariables.map((v) => ({
      name: v.name,
      value: v.value,
      externalId: v.externalId,
    })) ?? [];

  return json({
    project: {
      name: project.name,
      externalId: project.externalId,
      createdAt: project.createdAt.getTime(),
      envVars: project.environmentVariableSet.environmentVariables.map((v) => ({
        name: v.name,
        value: v.value,
        externalId: v.externalId,
      })),
      userVariables,
      publicKey: project.gitRepository.sshKeyPair.publicKey,
    },
    prebuildEvents: project.prebuildEvents.map((e) => ({
      branches: e.gitBranchLinks
        .map((b) => ({ name: b.gitBranch.name, externalId: b.gitBranch.externalId }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      commitHash: e.gitObject.hash.substring(0, 8),
      createdAt: e.createdAt.getTime(),
      externalPrebuildEventId: e.externalId,
      status: e.status,
    })),
    workspaces: project.prebuildEvents
      .flatMap((e) => e.workspaces)
      .map((w) => ({
        externalId: w.externalId,
        status: w.status,
        createdAt: w.createdAt.getTime(),
        name: w.name,
        lastOpenedAt: w.lastOpenedAt.getTime(),
        branchName: w.gitBranch.name,
        commitHash: w.prebuildEvent.gitObject.hash,
        agentHostname: config.agentHostname,
        workspaceHostname: w.activeInstance?.vmIp,
      })),
    gitRepository: {
      url: project.gitRepository.url,
    },
  });
};

export default function ProjectRoute(): JSX.Element {
  const { project, gitRepository, prebuildEvents, workspaces } = useLoaderData<typeof loader>();
  const createdAt = moment(project.createdAt).fromNow();

  const [searchParams] = useSearchParams();
  const tabsRef = useRef<TabsRef>(null);
  let tabId = parseInt(searchParams.get("tabId") ?? "0");
  if (isNaN(tabId)) {
    tabId = 0;
  }
  const setTabIdQueryParam = (tabId: number) => {
    const url = new URL(window.location as any);
    url.searchParams.set("tabId", tabId.toString());
    window.history.replaceState(null, "", url.toString());
  };

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
            <RepoSshKeyCard publicKey={project.publicKey} />
          </>
        )}
      </div>
      <Tabs.Group
        aria-label="Tabs with icons"
        /* eslint-disable-next-line react/style-prop-object */
        style="underline"
        className="mt-4"
        ref={tabsRef}
        onActiveTabChange={setTabIdQueryParam}
      >
        <Tabs.Item
          active={tabId === ProjectPathTabId.WORKSPACES}
          title={
            <>
              <i className="fa-solid fa-laptop-code mr-2"></i>
              <span className="font-bold">Workspaces</span>
            </>
          }
        >
          <WorkspaceList elements={workspaces} />
        </Tabs.Item>
        <Tabs.Item
          active={tabId === ProjectPathTabId.PREBUILDS}
          title={
            <>
              <i className="fa-solid fa-list-check mr-2"></i>
              <span className="font-bold">Prebuilds</span>
            </>
          }
        >
          <PrebuildList elements={prebuildEvents} />
        </Tabs.Item>
        <Tabs.Item
          active={tabId === ProjectPathTabId.ENVIRONMENT}
          title={
            <>
              <i className="fa-solid fa-terminal mr-2"></i>
              <span className="font-bold">Environment</span>
            </>
          }
        >
          <EnvironmentTab
            projectVariables={project.envVars}
            userVariables={project.userVariables}
            projectExternalId={project.externalId}
          />
        </Tabs.Item>
      </Tabs.Group>
    </AppPage>
  );
}
