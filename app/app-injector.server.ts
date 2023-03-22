import { createInjector, Scope } from "typed-inject";
import type { Config } from "~/config";
import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { Token } from "~/token";
import { UserService } from "~/user/user.service.server";

import { GitService } from "./git/git.service";
import { LicenseService } from "./license/license.service";
import { ProjectService } from "./project/project.service";
import { SshKeyService } from "./ssh-key/ssh-key.service";
import { clientFactory } from "./temporal/client-factory";
import { WorkspaceService } from "./workspace/workspace.service";

export const createAppInjector = (overrides: { [Token.Config]?: Config } = {}) =>
  createInjector()
    .provideValue(Token.Config, overrides[Token.Config] ?? config)
    .provideFactory(Token.Logger, newLogger, Scope.Transient)
    .provideClass(Token.LicenseService, LicenseService)
    .provideClass(Token.SshKeyService, SshKeyService)
    .provideClass(Token.GitService, GitService)
    .provideClass(Token.UserService, UserService)
    .provideClass(Token.ProjectService, ProjectService)
    .provideFactory(Token.TemporalClient, clientFactory)
    .provideClass(Token.WorkspaceService, WorkspaceService);
export type AppInjector = ReturnType<typeof createAppInjector>;
