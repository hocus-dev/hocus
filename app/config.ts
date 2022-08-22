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

export const getConfig = () =>
  ({
    env: get("NODE_ENV", "development"),
    gotrueUrl: get("GOTRUE_URL", "http://localhost:9999"),
    gotrueCookieDuration: parseInt(get("GOTRUE_COOKIE_DURATION", "2592000")),
    gotrueCookieDomain: get("gotrueCookieDomain", "localhost"),
  } as const);
export const CONFIG_INJECT_TOKEN = "CONFIG";
export type Config = ReturnType<typeof getConfig>;
