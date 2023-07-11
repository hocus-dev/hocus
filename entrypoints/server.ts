/* eslint-disable filename-rules/match */
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { createRequestHandler } from "@remix-run/express";
import type { LoaderArgs } from "@remix-run/node";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import csrf from "csurf";
import express from "express";
import { auth } from "express-openid-connect";

import { createAppInjector } from "~/app-injector.server";
import { HttpError } from "~/http-error.server";
import { OidcUserValidator } from "~/schema/oidc-user.validator.server";
import { TELEMETRY_DEPLOY_ID_COOKIE, TELEMETRY_DISABLED_COOKIE } from "~/telemetry/constants";
import { Token } from "~/token";

const db = new PrismaClient();
const appInjector = createAppInjector();
const config = appInjector.resolve(Token.Config);
const userService = appInjector.resolve(Token.UserService);
const initService = appInjector.resolve(Token.InitService);
const telemetryConfig = config.telemetry();
const telemetryService = appInjector.resolve(Token.TelemetryService);

// eslint-disable-next-line @typescript-eslint/no-floating-promises
telemetryService.init().then(async () => {
  telemetryService.capture({ event: "ui-start" });
});

const withClient = appInjector.resolve(Token.TemporalClient);

// eslint-disable-next-line @typescript-eslint/no-floating-promises
withClient(async (client) => {
  await initService.loadInitConfigFromFileIntoDb(db, client);
  await initService.runDumpLoop(db);
}).catch((err) => {
  /* eslint-disable no-console */
  console.error("Fatal error running init config operations. Config will not be saved to disk.");
  console.error(err);
  /* eslint-enable */
});

const BUILD_DIR = path.join(process.cwd(), "build");

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Remix fingerprints its assets so we can cache forever.
app.use("/build", express.static("public/build", { immutable: true, maxAge: "1y" }));

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("public", { maxAge: "1h" }));
app.use(cookieParser());
app.use("/app", auth(config.oidc()));
app.use(csrf({ cookie: true }));

app.all("*", async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "development") {
      purgeRequireCache();
    }
    if (telemetryConfig.disabled) {
      res.cookie(TELEMETRY_DISABLED_COOKIE, "1");
      res.clearCookie(TELEMETRY_DEPLOY_ID_COOKIE);
    } else {
      res.clearCookie(TELEMETRY_DISABLED_COOKIE);
      res.cookie(TELEMETRY_DEPLOY_ID_COOKIE, telemetryService.deployId);
    }

    const oidcUser = req.oidc?.user != null ? OidcUserValidator.Parse(req.oidc.user) : void 0;
    const user =
      oidcUser != null
        ? await userService.getOrCreateUser(db, {
            externalId: oidcUser.sub,
            gitEmail: oidcUser.email,
          })
        : void 0;

    return createRequestHandler({
      build:
        process.env.NODE_ENV === "production"
          ? // Workaround for this bug: https://github.com/remix-run/remix/issues/3032
            await import("@remix-run/dev/server-build")
          : require(BUILD_DIR),
      mode: process.env.NODE_ENV,
      getLoadContext: (): LoaderArgs["context"] => ({
        db,
        req,
        res,
        app: appInjector,
        user,
        oidcUser,
      }),
    })(req, res, next);
  } catch (err) {
    if (err instanceof HttpError) {
      return createRequestHandler({
        build:
          process.env.NODE_ENV === "production"
            ? // Workaround for this bug: https://github.com/remix-run/remix/issues/3032
              await import("@remix-run/dev/server-build")
            : require(BUILD_DIR),
        mode: process.env.NODE_ENV,
        getLoadContext: (): LoaderArgs["context"] => ({
          db,
          req,
          res,
          app: appInjector,
          user: void 0,
          oidcUser: void 0,
          expressError: err as any,
        }),
      })(req, res, next);
    } else {
      next(err);
    }
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Express server listening on port ${port}`);
});

function purgeRequireCache() {
  // purge require cache on requests for "server side HMR" this won't let
  // you have in-memory objects between requests in development,
  // alternatively you can set up nodemon/pm2-dev to restart the server on
  // file changes, but then you'll have to reconnect to databases/etc on each
  // change. We prefer the DX of this, so we've included it for you by default
  for (const key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}
