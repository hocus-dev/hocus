import { createInjector, Scope } from "typed-inject";
import { GoogleAnalyticsService } from "~/analytics/google-analytics.service.server";
import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { TaskService } from "~/tasks/task.service.server";
import { Token } from "~/token";
import { UserService } from "~/user/user.service.server";

import { ProjectService } from "./project/project.service";
import { SshKeyService } from "./ssh-key/ssh-key.service";
import { clientFactory } from "./temporal/client-factory";
import { WorkspaceService } from "./workspace/workspace.service";

export const createAppInjector = () =>
  createInjector()
    .provideValue(Token.Config, config)
    .provideFactory(Token.Logger, newLogger, Scope.Transient)
    .provideClass(Token.GoogleAnalyticsService, GoogleAnalyticsService)
    .provideClass(Token.TaskService, TaskService)
    .provideClass(Token.UserService, UserService)
    .provideClass(Token.ProjectService, ProjectService)
    .provideFactory(Token.TemporalClient, clientFactory)
    .provideClass(Token.SshKeyService, SshKeyService)
    .provideClass(Token.WorkspaceService, WorkspaceService);
export type AppInjector = ReturnType<typeof createAppInjector>;
