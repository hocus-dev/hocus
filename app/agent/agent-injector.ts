import { DefaultLogger } from "@temporalio/worker";
import { createInjector, Scope } from "typed-inject";
import { config } from "~/config";
import { GitService } from "~/git/git.service";
import { PerfService } from "~/perf.service.server";
import { ProjectService } from "~/project/project.service";
import { SshKeyService } from "~/ssh-key/ssh-key.service";
import { clientFactory } from "~/temporal/client-factory";
import { Token } from "~/token";
import { WorkspaceService } from "~/workspace/workspace.service";

import { AgentUtilService } from "./agent-util.service";
import { BuildfsService } from "./buildfs.service";
import { factoryFirecrackerService } from "./firecracker.service";
import { AgentGitService } from "./git/git.service";
import { PrebuildService } from "./prebuild.service";
import { ProjectConfigService } from "./project-config/project-config.service";
import { SSHGatewayService } from "./ssh-gateway.service";
import { LowLevelStorageService, StorageService } from "./storage/storage.service";
import { WorkspaceAgentService } from "./workspace-agent.service";

export const createAgentInjector = (
  overrides: {
    [Token.Config]?: typeof config;
    [Token.Logger]?: typeof DefaultLogger;
    [Token.LowLevelStorageService]?: typeof LowLevelStorageService;
    [Token.StorageService]?: typeof StorageService;
    [Token.PrebuildService]?: typeof PrebuildService;
    [Token.AgentUtilService]?: typeof AgentUtilService;
    [Token.FirecrackerService]?: typeof factoryFirecrackerService;
    [Token.ProjectConfigService]?: typeof ProjectConfigService;
    [Token.SSHGatewayService]?: typeof SSHGatewayService;
    [Token.BuildfsService]?: typeof BuildfsService;
    [Token.GitService]?: typeof GitService;
    [Token.AgentGitService]?: typeof AgentGitService;
    [Token.ProjectService]?: typeof ProjectService;
    [Token.WorkspaceService]?: typeof WorkspaceService;
    [Token.WorkspaceAgentService]?: typeof WorkspaceAgentService;
    [Token.SshKeyService]?: typeof SshKeyService;
    [Token.TemporalClient]?: typeof clientFactory;
    [Token.PerfService]?: typeof PerfService;
  } = {},
) =>
  createInjector()
    .provideValue(Token.Config, overrides[Token.Config] ?? config)
    .provideClass(Token.Logger, overrides[Token.Logger] ?? DefaultLogger, Scope.Transient)
    .provideClass(Token.PerfService, overrides[Token.PerfService] ?? PerfService)
    .provideClass(
      Token.LowLevelStorageService,
      overrides[Token.LowLevelStorageService] ?? LowLevelStorageService,
    )
    .provideClass(Token.StorageService, overrides[Token.StorageService] ?? StorageService)
    .provideClass(Token.AgentUtilService, overrides[Token.AgentUtilService] ?? AgentUtilService)
    .provideClass(Token.WorkspaceService, overrides[Token.WorkspaceService] ?? WorkspaceService)
    .provideClass(Token.SshKeyService, overrides[Token.SshKeyService] ?? SshKeyService)
    .provideClass(Token.GitService, overrides[Token.GitService] ?? GitService)
    .provideClass(Token.AgentGitService, overrides[Token.AgentGitService] ?? AgentGitService)
    .provideClass(Token.ProjectService, overrides[Token.ProjectService] ?? ProjectService)
    .provideClass(
      Token.ProjectConfigService,
      overrides[Token.ProjectConfigService] ?? ProjectConfigService,
    )
    .provideClass(Token.BuildfsService, overrides[Token.BuildfsService] ?? BuildfsService)
    .provideClass(Token.PrebuildService, overrides[Token.PrebuildService] ?? PrebuildService)
    .provideClass(Token.SSHGatewayService, overrides[Token.SSHGatewayService] ?? SSHGatewayService)
    .provideFactory(
      Token.FirecrackerService,
      overrides[Token.FirecrackerService] ?? factoryFirecrackerService,
    )
    .provideClass(
      Token.WorkspaceAgentService,
      overrides[Token.WorkspaceAgentService] ?? WorkspaceAgentService,
    )
    .provideFactory(Token.TemporalClient, overrides[Token.TemporalClient] ?? clientFactory);
export type AgentInjector = ReturnType<typeof createAgentInjector>;
