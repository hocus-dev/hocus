import { createInjector, Scope } from "typed-inject";
import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { Token } from "~/token";

import { GAEventName } from "./event.server";
import { GoogleAnalyticsService } from "./google-analytics.service.server";

type Args = {
  gaService: GoogleAnalyticsService;
};

const customConfig: typeof config = {
  ...config,
  env: () => "test",
  googleAnalytics: () => ({
    ...config.googleAnalytics(),
    url: "https://www.google-analytics.com/debug",
  }),
};

const makeInjector = () =>
  createInjector()
    .provideValue(Token.Config, customConfig)
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

    // TODO: expect an invalid event to throw an error
    await gaService.sendEvent({
      name: GAEventName.SignUp,
      userId: "123",
      params: {
        xd: "google",
      } as any,
    });
  }),
);
