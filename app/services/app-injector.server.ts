import { createInjector, Scope } from "typed-inject";
import { getConfig } from "~/config.server";
import { newLogger } from "~/logger.server";

import { UserService } from "./user.service.server";

export const createAppInjector = () =>
  createInjector()
    .provideFactory("Config", getConfig)
    .provideFactory("Logger", newLogger, Scope.Transient)
    .provideClass("UserService", UserService);
export type AppInjector = ReturnType<typeof createAppInjector>;
