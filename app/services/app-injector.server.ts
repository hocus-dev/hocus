import { createInjector, Scope } from "typed-inject";
import { getConfig } from "~/config.server";
import { newLogger } from "~/logger.server";

export const createAppInjector = () =>
  createInjector()
    .provideFactory("Config", getConfig)
    .provideFactory("Logger", newLogger, Scope.Transient);
export type AppInjector = ReturnType<typeof createAppInjector>;
