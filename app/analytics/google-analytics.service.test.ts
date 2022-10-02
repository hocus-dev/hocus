import * as sinon from "ts-sinon";
import { createInjector } from "typed-inject";
import winston from "winston";
import { config } from "~/config";
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
    .provideValue(Token.Logger, sinon.stubObject(winston.createLogger()))
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

    await expect(
      gaService.sendEvent({
        params: {
          xd: "google",
        },
      } as any),
    ).rejects.toThrow();
  }),
);
