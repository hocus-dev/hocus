import { makeConfig, get, getEnv } from "./utils.server";

import {
  DEFAULT_PREBUILD_SSH_KEY_PRIVATE,
  DEFAULT_PREBUILD_SSH_KEY_PUBLIC,
} from "~/agent/constants";
import { HOCUS_LICENSE_PUBLIC_KEY } from "~/license/constants";

const parseIntWithMin = (value: string, min: number): number => {
  const parsed = parseInt(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Value must be a number`);
  }
  if (parsed < min) {
    throw new Error(`Value must be at least ${min}`);
  }
  return parsed;
};

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
  controlPlane: () => ({
    agentHostname: get("CONTROL_PLANE_AGENT_HOSTNAME", "localhost"),
    license: process.env.HOCUS_LICENSE ?? void 0,
    licensePublicKey: HOCUS_LICENSE_PUBLIC_KEY,
  }),
  shared: () => ({
    maxRepositoryDriveSizeMib: parseIntWithMin(
      process.env.SHARED_MAX_REPOSITORY_DRIVE_SIZE_MIB ?? "5000",
      10,
    ),
  }),
  agent: () => ({
    temporalAddress: get("AGENT_TEMPORAL_ADDRESS", "localhost:7233"),
    databaseUrl: get("AGENT_DATABASE_URL", "postgres://postgres:pass@localhost:5432/rooms"),
    defaultKernel: get("AGENT_KERNEL_PATH", "/srv/jailer/resources/vmlinux-6.2-x86_64.bin"),
    hostBuildfsResourcesDir: get("AGENT_HOST_BUILDFS_RESOURCES_DIR", "/app/resources"),
    buildfsRootFs: get("AGENT_BUILDFS_ROOTFS", "/srv/jailer/resources/buildfs.ext4"),
    // `get` is not used here because users usually will not want to set these manually
    // in production. `get` would throw an error if the env var was not set.
    fetchRepositoryRootFs:
      process.env.AGENT_FETCH_REPOSITORY_ROOTFS_PATH ?? "/srv/jailer/resources/fetchrepo.ext4",
    checkoutAndInspectRootFs:
      process.env.AGENT_CHECKOUT_AND_INSPECT_ROOTFS_PATH ??
      "/srv/jailer/resources/checkout-and-inspect.ext4",
    defaultWorkspaceRootFs:
      process.env.DEFAULT_WORKSPACE_ROOTFS_PATH ?? "/srv/jailer/resources/default-workspace.ext4",
    prebuildSshPublicKey:
      process.env.AGENT_PREBUILD_SSH_PUBLIC_KEY ?? DEFAULT_PREBUILD_SSH_KEY_PUBLIC,
    prebuildSshPrivateKey:
      process.env.AGENT_PREBUILD_SSH_PRIVATE_KEY ?? DEFAULT_PREBUILD_SSH_KEY_PRIVATE,

    // If set then the agent will setup projects for running hocus in hocus when starting
    createHocusProjects: (process.env.AGENT_DEV_CREATE_HOCUS_PROJECTS ?? "false") === "true",
    // If set then the agent will setup projects for hocus developement
    // Those projects should be used for developing Hocus
    // For now those projects are private and we hardcoded a private key in the codebase
    // They will be public soon anyway :)
    createDevelopementProjects:
      (process.env.AGENT_DEV_CREATE_DEVELOPEMENT_PROJECTS ?? "false") === "true",
    blockRegistryRoot: "/srv/jailer/block-registry/",
    blockRegistryConfigFsPath: "/sys/kernel/config",
  }),
  hocusRepoAccess: () => ({
    // Temporarily the Hocus repo is private :P Will be removed soon.
    // Sets a deploy key in the agent which has access to the Hocus repo
    hocusRepoPrivateKey: get("HOCUS_REPO_PRIVATE_KEY", ""),
  }),
  // Environment variables for the hocus dev env
  agentDev: () => ({
    // Normally the gitUsername/gitEmail is set to the email&name from OIDC or set in the UI by the user
    // In the dev env we have a user dev/dev, this overrides the git settings for that user
    gitName: process.env.HOCUS_DEV_GIT_NAME ?? "dev",
    gitEmail: process.env.HOCUS_DEV_GIT_EMAIL ?? "dev@example.com",
  }),
  temporalConnection: () => ({
    temporalServerUrl:
      process.env.TEMPORAL_SERVER_URL ?? process.env.AGENT_TEMPORAL_ADDRESS ?? "localhost:7233",
  }),
  telemetry: () => ({
    disabled: (process.env.TELEMETRY_DISABLED ?? "") !== "",
  }),
  perfMonitoring: () => ({
    enabled: (process.env.PERF_MONITORING_ENABLED ?? "") !== "",
  }),
  init: () => ({
    configLoadEnabled: (process.env.INIT_CONFIG_LOAD_ENABLED ?? "") !== "",
    configLoadPath: process.env.INIT_CONFIG_LOAD_PATH ?? "/hocus-init/config.yaml",
    configDumpEnabled: (process.env.INIT_CONFIG_DUMP_ENABLED ?? "") !== "",
    configDumpPath: process.env.INIT_CONFIG_DUMP_PATH ?? "/hocus-init/config.yaml",
    configDumpIntervalSeconds: parseIntWithMin(
      process.env.INIT_CONFIG_DUMP_INTERVAL_SECONDS ?? "15",
      1,
    ),
  }),
});
