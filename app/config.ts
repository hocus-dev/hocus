import type { valueof } from "./types/utils";
import { SuperJsonCrasher } from "./utils";

const env = process.env.NODE_ENV;

const get = <D>(envVarName: string, defaultValue: D): string | D => {
  const envVar = process.env[envVarName];
  if (envVar == null) {
    if (env === "development" || env === "test") {
      return defaultValue;
    }
    throw new Error(`Missing env var ${envVarName}`);
  }
  return envVar;
};

export type Env = valueof<typeof Env>;
export const Env = {
  Production: "production",
  Development: "development",
  Test: "test",
} as const;

const getEnv = (): Env => {
  const allowedValues = Object.values(Env);
  if (!allowedValues.includes(env as Env)) {
    throw new Error(`Invalid NODE_ENV: ${env}. Must be one of ${allowedValues}`);
  }
  return env as Env;
};

export const getConfig = () =>
  ({
    env: getEnv(),
    logLevel: get("LOG_LEVEL", "debug"),
    oidc: {
      issuerBaseURL: get("OIDC_ISSUER_BASE_URL", "http://localhost:4200/realms/hocus"),
      baseURL: get("OIDC_BASE_URL", "http://localhost:3000/app"),
      clientID: get("OIDC_CLIENT_ID", "hocus"),
      clientSecret: get("OIDC_CLIENT_SECRET", "dev-client-secret"),
      secret: get("OIDC_SECRET", "LONG_RANDOM_VALUE"),
      routes: { postLogoutRedirect: get("OIDC_POST_LOGOUT_REDIRECT", "http://localhost:3000/") },
      idpLogout: true,
    },
    // This class contains a circular reference to itself, so when superjson
    // tries to serialize it, it will throw an error. This is a precaution
    // not to inadvertently pass the config object to the frontend.
    _superjsonCrasher: new SuperJsonCrasher(),
  } as const);
export type Config = ReturnType<typeof getConfig>;
