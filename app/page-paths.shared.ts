import qs from "qs";

import type { valueof } from "./types/utils";

export const PagePaths = {
  Logout: "/app/logout",
  ProjectList: "/app/projects",
  NewProject: "/app/new-project",
  CreateWorkspace: "/app/workspaces/create",
  EditProjectEnvironment: "/app/projects/env",
  UserSettings: "/app/user/settings",
  UserSettingsSshKeyDelete: "/app/user/settings/ssh-key/delete",
  UserSettingsSshKeyCreate: "/app/user/settings/ssh-key/create",
  SchedulePrebuild: "/app/prebuilds/schedule",
  ArchivePrebuild: "/app/prebuilds/archive",
} as const;

export type ProjectPathTabId = valueof<typeof ProjectPathTabId>;
export const ProjectPathTabId = {
  WORKSPACES: "workspaces",
  PREBUILDS: "prebuilds",
  ENVIRONMENT: "environment",
  SETTINGS: "settings",
} as const;

export const getProjectPath = (projectExternalId: string, tabId?: ProjectPathTabId) =>
  `/app/projects/${projectExternalId}/${tabId ?? ProjectPathTabId.WORKSPACES}` as const;

export const WorkspacePathParams = {
  JUST_CREATED: "justCreated",
  JUST_STARTED: "justStarted",
  SHOULD_OPEN: "shouldOpen",
  JUST_STOPPED: "justStopped",
  JUST_DELETED: "justDeleted",
  PROJECT_ID: "projectId",
} as const;

export const getWorkspacePath = (
  workspaceExternalId: string,
  options: {
    [WorkspacePathParams.JUST_STARTED]?: boolean;
    [WorkspacePathParams.JUST_CREATED]?: boolean;
    [WorkspacePathParams.SHOULD_OPEN]?: boolean;
    [WorkspacePathParams.JUST_STOPPED]?: boolean;
    [WorkspacePathParams.JUST_DELETED]?: boolean;
    [WorkspacePathParams.PROJECT_ID]?: string;
  },
) => {
  const optionsExist = Array.from(Object.values(options)).some((v) => v);
  return `/app/workspaces/${workspaceExternalId}${
    optionsExist ? `?${qs.stringify(options)}` : ""
  }` as const;
};
export const getNewWorkspacePath = (
  args:
    | {
        projectExternalId: string;
      }
    | { prebuildExternalId: string },
) => {
  const query = qs.stringify({
    projectId: (args as any).projectExternalId,
    prebuildId: (args as any).prebuildExternalId,
  });
  return `/app/workspaces/new?${query}` as const;
};

export const getWorkspaceStartPath = (workspaceExternalId: string) =>
  `/app/workspaces/start/${workspaceExternalId}` as const;
export const getWorkspaceStopPath = (workspaceExternalId: string) =>
  `/app/workspaces/stop/${workspaceExternalId}` as const;
export const getWorkspaceStatusPath = (workspaceExternalId: string) =>
  `/app/workspaces/status/${workspaceExternalId}` as const;
export const getWorkspaceDeletePath = (workspaceExternalId: string) =>
  `/app/workspaces/delete/${workspaceExternalId}` as const;

export const getPrebuildPath = (prebuildExternalId: string, taskIdx?: number) =>
  `/app/prebuilds/${prebuildExternalId}${taskIdx != null ? `?task=${taskIdx}` : ""}` as const;
export const getPrebuildLogsPath = (prebuildExternalId: string, taskExternalId: string) =>
  `/app/prebuilds/logs?prebuildExternalId=${prebuildExternalId}&taskExternalId=${taskExternalId}` as const;

export type SettingsPageTab = valueof<typeof SettingsPageTab>;
export const SettingsPageTab = {
  SshKeys: "ssh-keys",
  Git: "git",
} as const;

export const getUserSettingsPath = (tab: SettingsPageTab) => `/app/user/settings/${tab}` as const;
