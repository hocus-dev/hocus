/* eslint-disable filename-rules/match */
import * as dotenv from "dotenv";
dotenv.config();

// eslint-disable-next-line import/first
import { makeConfig, get, getEnv } from "./utils.server";

export type Config = typeof config;
export const config = makeConfig()({
  env: getEnv,
  logLevel: () => process.env.LOG_LEVEL ?? "info",
  oidc: () => ({
    issuerBaseURL: get("OIDC_ISSUER_BASE_URL", "http://localhost:4200/realms/hocus"),
    baseURL: get("OIDC_BASE_URL", "http://localhost:3000/app"),
    clientID: get("OIDC_CLIENT_ID", "hocus"),
    clientSecret: get("OIDC_CLIENT_SECRET", "dev-client-secret"),
    secret: get("OIDC_SECRET", "LONG_RANDOM_VALUE"),
    routes: { postLogoutRedirect: get("OIDC_POST_LOGOUT_REDIRECT", "http://localhost:3000/") },
    idpLogout: true,
  }),
  graphileWorker: () => ({
    connectionString: get(
      "GRAPHILE_WORKER_CONNECTION_URL",
      "postgres://postgres:pass@localhost:5432/rooms",
    ),
  }),
});
