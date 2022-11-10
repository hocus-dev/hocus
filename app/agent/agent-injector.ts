import { DefaultLogger } from "@temporalio/worker";
import { createInjector, Scope } from "typed-inject";
import { config } from "~/config";
import { Token } from "~/token";

import { AgentUtilService } from "./agent-util.service";
import { factoryFirecrackerService } from "./firecracker.service";
import { ProjectConfigService } from "./project-config/project-config.service";
import { LowLevelStorageService, StorageService } from "./storage/storage.service";

export const createAgentInjector = (
  overrides: {
    [Token.Config]?: typeof config;
    [Token.Logger]?: typeof DefaultLogger;
    [Token.LowLevelStorageService]?: typeof LowLevelStorageService;
    [Token.StorageService]?: typeof StorageService;
    [Token.AgentUtilService]?: typeof AgentUtilService;
    [Token.FirecrackerService]?: typeof factoryFirecrackerService;
    [Token.ProjectConfigService]?: typeof ProjectConfigService;
  } = {},
) =>
  createInjector()
    .provideValue(Token.Config, overrides[Token.Config] ?? config)
    .provideClass(Token.Logger, overrides[Token.Logger] ?? DefaultLogger, Scope.Transient)
    .provideClass(
      Token.LowLevelStorageService,
      overrides[Token.LowLevelStorageService] ?? LowLevelStorageService,
    )
    .provideClass(Token.StorageService, overrides[Token.StorageService] ?? StorageService)
    .provideClass(Token.AgentUtilService, overrides[Token.AgentUtilService] ?? AgentUtilService)
    .provideFactory(
      Token.FirecrackerService,
      overrides[Token.FirecrackerService] ?? factoryFirecrackerService,
    )
    .provideClass(
      Token.ProjectConfigService,
      overrides[Token.ProjectConfigService] ?? ProjectConfigService,
    );
export type AgentInjector = ReturnType<typeof createAgentInjector>;
