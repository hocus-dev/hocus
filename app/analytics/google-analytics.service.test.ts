import { createInjector, Scope } from "typed-inject";
import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { Token } from "~/token";

import { GAEventName } from "./event.server";
import { GoogleAnalyticsService } from "./google-analytics.service.server";

type Args = {
  gaService: GoogleAnalyticsService;
};
const makeInjector = () =>
  createInjector()
    .provideValue(Token.Config, config)
    .provideFactory(Token.Logger, newLogger, Scope.Transient)
    .provideClass(Token.GoogleAnalyticsService, GoogleAnalyticsService);

const provideGAService = (testFn: (args: Args) => Promise<void>): (() => Promise<void>) => {
  const injector = makeInjector();
  return async () => {
    await testFn({ gaService: injector.resolve(Token.GoogleAnalyticsService) });
  };
};

test.concurrent(
  "sendEvent",
  provideGAService(async ({ gaService }) => {
    await gaService.sendEvent({
      name: GAEventName.SignUp,
      userId: "123",
      params: {
        method: "google",
      },
    });
  }),
);
