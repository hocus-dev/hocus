export const PagePaths = {
  Logout: "/app/logout",
  Settings: "/app/settings",
  ProjectList: "/app/projects",
  NewProject: "/app/new-project",
  CreateWorkspace: "/app/workspaces/create",
} as const;

export const getProjectPath = (projectId: string) => `/app/projects/${projectId}` as const;
export const getWorkspacePath = (workspaceExternalId: string) =>
  `/app/workspaces/${workspaceExternalId}` as const;
export const getWorkspaceStartPath = (workspaceExternalId: string) =>
  `/app/workspaces/start/${workspaceExternalId}` as const;
