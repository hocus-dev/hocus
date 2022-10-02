import { createInjector, Scope } from "typed-inject";
import { GoogleAnalyticsService } from "~/analytics/google-analytics.service.server";
import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { Token } from "~/token";

import { SendGAEventTaskRunnerService } from "./runners/send-ga-event-task-runner.service.server";

export const createTaskRunnerInjector = () =>
  createInjector()
    .provideValue(Token.Config, config)
    .provideFactory(Token.Logger, newLogger, Scope.Transient)
    .provideClass(Token.GoogleAnalyticsService, GoogleAnalyticsService)
    .provideClass(Token.SendGAEventTaskRunnerService, SendGAEventTaskRunnerService);
export type TaskRunnerInjector = ReturnType<typeof createTaskRunnerInjector>;
