import qs from "qs";

export const PagePaths = {
  Logout: "/app/logout",
  Settings: "/app/settings",
  ProjectList: "/app/projects",
  NewProject: "/app/new-project",
  CreateWorkspace: "/app/workspaces/create",
} as const;

export const getProjectPath = (projectId: string) => `/app/projects/${projectId}` as const;

export const WorkspacePathParams = {
  JUST_CREATED: "justCreated",
  JUST_STARTED: "justStarted",
  SHOULD_OPEN: "shouldOpen",
  JUST_STOPPED: "justStopped",
} as const;

export const getWorkspacePath = (
  workspaceExternalId: string,
  options: {
    [WorkspacePathParams.JUST_STARTED]?: boolean;
    [WorkspacePathParams.JUST_CREATED]?: boolean;
    [WorkspacePathParams.SHOULD_OPEN]?: boolean;
    [WorkspacePathParams.JUST_STOPPED]?: boolean;
  },
) => {
  const optionsExist = Array.from(Object.values(options)).some((v) => v);
  return `/app/workspaces/${workspaceExternalId}${
    optionsExist ? `?${qs.stringify(options)}` : ""
  }` as const;
};
export const getWorkspaceStartPath = (workspaceExternalId: string) =>
  `/app/workspaces/start/${workspaceExternalId}` as const;
export const getWorkspaceStopPath = (workspaceExternalId: string) =>
  `/app/workspaces/stop/${workspaceExternalId}` as const;
export const getWorkspaceStatusPath = (workspaceExternalId: string) =>
  `/app/workspaces/status/${workspaceExternalId}` as const;
