import { DefaultLogger } from "@temporalio/worker";
import { createInjector, Scope } from "typed-inject";
import { config } from "~/config";
import { Token } from "~/token";

import { AgentUtilService } from "./agent-util.service";
import { BuildfsService } from "./buildfs.service";
import { factoryFirecrackerService } from "./firecracker.service";
import { GitService } from "./git/git.service";
import { PrebuildService } from "./prebuild.service";
import { ProjectConfigService } from "./project-config/project-config.service";
import { SSHGatewayService } from "./ssh-gateway.service";
import { LowLevelStorageService, StorageService } from "./storage/storage.service";

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
  } = {},
) =>
  createInjector()
    .provideValue(Token.Config, overrides[Token.Config] ?? config)
    .provideClass(Token.Logger, overrides[Token.Logger] ?? DefaultLogger, Scope.Transient)
    .provideClass(
      Token.LowLevelStorageService,
      overrides[Token.LowLevelStorageService] ?? LowLevelStorageService,
    )
    .provideClass(Token.GitService, overrides[Token.GitService] ?? GitService)
    .provideClass(Token.StorageService, overrides[Token.StorageService] ?? StorageService)
    .provideClass(Token.AgentUtilService, overrides[Token.AgentUtilService] ?? AgentUtilService)
    .provideClass(Token.PrebuildService, overrides[Token.PrebuildService] ?? PrebuildService)
    .provideClass(Token.BuildfsService, overrides[Token.BuildfsService] ?? BuildfsService)
    .provideClass(Token.SSHGatewayService, overrides[Token.SSHGatewayService] ?? SSHGatewayService)
    .provideFactory(
      Token.FirecrackerService,
      overrides[Token.FirecrackerService] ?? factoryFirecrackerService,
    )
    .provideClass(
      Token.ProjectConfigService,
      overrides[Token.ProjectConfigService] ?? ProjectConfigService,
    );
export type AgentInjector = ReturnType<typeof createAgentInjector>;
