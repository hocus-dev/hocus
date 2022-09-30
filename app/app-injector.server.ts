import { createInjector, Scope } from "typed-inject";
import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { Token } from "~/token";
import { UserService } from "~/user/user.service.server";

export const createAppInjector = () =>
  createInjector()
    .provideValue(Token.Config, config)
    .provideFactory(Token.Logger, newLogger, Scope.Transient)
    .provideClass(Token.UserService, UserService);
export type AppInjector = ReturnType<typeof createAppInjector>;
