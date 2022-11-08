import { makeConfig, get, getEnv } from "./utils.server";

export type Config = typeof config;
export const config = makeConfig()({
  env: getEnv,
  logLevel: () => get("LOG_LEVEL", "info"),
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
  googleAnalytics: () => ({
    clientId: get("GOOGLE_ANALYTICS_CLIENT_ID", "server"),
    measurementId: get("GOOGLE_ANALYTICS_MEASUREMENT_ID", "G-XXXXXXXXXX"),
    apiSecret: get("GOOGLE_ANALYTICS_API_SECRET", "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    url: get("GOOGLE_ANALYTICS_URL", "https://www.google-analytics.com/debug"),
  }),
  agent: () => ({
    defaultKernel: get("AGENT_KERNEL_PATH", "/hocus-resources/vmlinux-5.6-x86_64.bin"),
    checkoutAndInspectRootFs: get(
      "AGENT_CHECKOUT_AND_INSPECT_ROOTFS_PATH",
      "/hocus-resources/checkout-and-inspect.ext4",
    ),
  }),
});
