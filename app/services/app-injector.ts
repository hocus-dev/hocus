import { createInjector, Scope } from "typed-inject";
import { getConfig } from "~/config";
import { newLogger } from "~/logger";

export const createAppInjector = () =>
  createInjector()
    .provideFactory("Config", getConfig)
    .provideFactory("Logger", newLogger, Scope.Transient);
export type AppInjector = ReturnType<typeof createAppInjector>;
