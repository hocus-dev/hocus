import { createInjector, Scope } from "typed-inject";
import type { Logger } from "winston";
import type { Config } from "~/config";
import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { Token } from "~/token";
import { UserService } from "~/user/user.service.server";

import { GitService } from "./git/git.service";
import { LicenseService } from "./license/license.service";
import { PerfService } from "./perf.service.server";
import { ProjectService } from "./project/project.service";
import { SshKeyService } from "./ssh-key/ssh-key.service";
import { clientFactory } from "./temporal/client-factory";
import { TimeService } from "./time.service";
import { WorkspaceService } from "./workspace/workspace.service";

export const createAppInjector = (
  overrides: {
    [Token.Config]?: Config;
    [Token.TimeService]?: typeof TimeService;
    [Token.Logger]?: Logger;
  } = {},
) =>
  createInjector()
    .provideValue(Token.Config, overrides[Token.Config] ?? config)
    .provideClass(Token.TimeService, overrides[Token.TimeService] ?? TimeService)
    .provideFactory(
      Token.Logger,
      overrides[Token.Logger] !== void 0 ? (): Logger => overrides[Token.Logger] as any : newLogger,
      Scope.Transient,
    )
    .provideClass(Token.PerfService, PerfService)
    .provideClass(Token.LicenseService, LicenseService)
    .provideClass(Token.SshKeyService, SshKeyService)
    .provideClass(Token.GitService, GitService)
    .provideClass(Token.UserService, UserService)
    .provideClass(Token.ProjectService, ProjectService)
    .provideFactory(Token.TemporalClient, clientFactory)
    .provideClass(Token.WorkspaceService, WorkspaceService);
export type AppInjector = ReturnType<typeof createAppInjector>;
