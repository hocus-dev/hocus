/* eslint-disable filename-rules/match */

import type { valueof } from "./types/utils";

/**
 * Injection tokens
 */
export type Token = valueof<typeof Token>;
export const Token = {
  Config: "ConfigT",
  Logger: "LoggerT",
  UserService: "UserServiceT",
  GoogleAnalyticsService: "GoogleAnalyticsServiceT",
  TaskService: "TaskServiceT",
  SendGAEventTaskRunnerService: "SendGAEventTaskRunnerServiceT",
  FirecrackerService: "FirecrackerServiceT",
  QemuService: "QemuServiceT",
  StorageService: "StorageServiceT",
  LowLevelStorageService: "LowLevelStorageServiceT",
  ProjectConfigService: "ProjectConfigServiceT",
  AgentUtilService: "AgentUtilServiceT",
  SSHGatewayService: "SSHGatewayServiceT",
  PrebuildService: "PrebuildServiceT",
  BuildfsService: "BuildfsServiceT",
  AgentGitService: "AgentGitServiceT",
  ProjectService: "ProjectServiceT",
  WorkspaceService: "WorkspaceServiceT",
  WorkspaceAgentService: "WorkspaceAgentServiceT",
  TemporalClient: "TemporalClientT",
  SshKeyService: "SshKeyServiceT",
  GitService: "GitServiceT",
  LicenseService: "LicenseServiceT",
  TimeService: "TimeServiceT",
  TelemetryService: "TelemetryServiceT",
  PerfService: "PerfServiceT",
  InitService: "InitServiceT",
  BlockRegistryService: "BlockRegistryServiceT",
  WorkspaceNetworkService: "WorkspaceNetworkServiceT",
} as const;
