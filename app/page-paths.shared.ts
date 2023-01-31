export const PagePaths = {
  Logout: "/app/logout",
  Settings: "/app/settings",
  ProjectList: "/app/projects",
  NewProject: "/app/new-project",
} as const;

export const getProjectPath = (projectId: string) => `/app/projects/${projectId}` as const;
