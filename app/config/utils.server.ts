import type { valueof } from "~/types/utils";

const env = process.env.NODE_ENV;

export const get = <D>(envVarName: string, defaultValue: D): string | D => {
  const envVar = process.env[envVarName];
  if (envVar == null) {
    if (env === Env.Development || env === Env.Test) {
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

export const getEnv = (): Env => {
  const allowedValues = Object.values(Env);
  if (!allowedValues.includes(env as Env)) {
    throw new Error(`Invalid NODE_ENV: ${env}. Must be one of ${allowedValues}`);
  }
  return env as Env;
};

type ConfigGetter<T> = () => T;
export const makeConfig =
  <K extends string>() =>
  <V, T extends Record<K, ConfigGetter<V>>>(configGetters: T): T =>
    configGetters;
