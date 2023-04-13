export type GitRepoConnectionStatus =
  | { status: "connected"; lastConnectedAt: number }
  | { status: "disconnected"; error?: { message: string; occurredAt: number } };
