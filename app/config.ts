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
    gotrueUrl: get("GOTRUE_URL", "http://localhost:9999"),
    gotrueCookieDuration: parseInt(get("GOTRUE_COOKIE_DURATION", "2592000")),
    gotrueCookieDomain: get("GOTRUE_COOKIE_DOMAIN", "localhost"),
    logLevel: get("LOG_LEVEL", "debug"),
    // This class contains a circular reference to itself, so when superjson
    // tries to serialize it, it will throw an error. This is a precaution
    // not to inadvertently pass the config object to the frontend.
    _superjsonCrasher: new SuperJsonCrasher(),
  } as const);
export type Config = ReturnType<typeof getConfig>;
