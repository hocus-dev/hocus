import { createInjector, Scope } from "typed-inject";
import { getConfig } from "~/config";
import { newLogger } from "~/logger";

import { AuthService } from "./auth.service";

export const createAppInjector = () =>
  createInjector()
    .provideFactory("Config", getConfig)
    .provideFactory("Logger", newLogger, Scope.Transient)
    .provideClass("AuthService", AuthService);
export type AppInjector = ReturnType<typeof createAppInjector>;
