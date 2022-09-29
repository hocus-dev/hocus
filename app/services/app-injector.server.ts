import { createInjector, Scope } from "typed-inject";
import { config } from "~/config";
import { newLogger } from "~/logger.server";

import { UserService } from "./user.service.server";

export const createAppInjector = () =>
  createInjector()
    .provideValue("Config", config)
    .provideFactory("Logger", newLogger, Scope.Transient)
    .provideClass("UserService", UserService);
export type AppInjector = ReturnType<typeof createAppInjector>;
