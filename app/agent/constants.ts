export const WORKSPACE_DEV_DIR = "/home/hocus/dev" as const;
export const WORKSPACE_REPOSITORY_DIR = `${WORKSPACE_DEV_DIR}/project` as const;
export const WORKSPACE_ENV_DIR = `${WORKSPACE_DEV_DIR}/.hocus` as const;
export const WORKSPACE_ENV_SCRIPT_PATH = `${WORKSPACE_ENV_DIR}/env.sh` as const;
export const WORKSPACE_CONFIG_SYMLINK_PATH = `${WORKSPACE_ENV_DIR}/workspace-config.yml` as const;
export const WORKSPACE_SCRIPTS_DIR = `${WORKSPACE_DEV_DIR}/.hocus/command` as const;
export const WORKSPACE_GIT_CONFIGURED_MARKER_PATH =
  `${WORKSPACE_DEV_DIR}/.hocus/git-configured` as const;
export const WORKSPACE_GIT_CHECKED_OUT_MARKER_PATH =
  `${WORKSPACE_DEV_DIR}/.hocus/git-checked-out` as const;

export const PREBUILD_TASK_SCRIPT_TEMPLATE = (task: string) => `#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset
set -o allexport

source "${WORKSPACE_ENV_SCRIPT_PATH}"

set -o xtrace

${task}
`;

/*
 * I'm including the boot time and a new line so one may easily distinguish
 * logs from different boots - I've decided to do so after starting and stopping the vm multiple times :)
 */
export const TASK_INPUT_TEMPLATE = (task: string, cwd: string) =>
  `
# Hocus task boot time ${Date.now()}
source "${WORKSPACE_ENV_SCRIPT_PATH}"
cd ${cwd}
${task}
`;

export const ATTACH_TO_TASK_SCRIPT_TEMPLATE = (socketPath: string, logPath: string) => `#!/bin/bash
clear
cat ${logPath} && dtach -a ${socketPath} -r none -E -z
`;

export const DEFAULT_PREBUILD_SSH_KEY_PUBLIC = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKk+DZs+E2GlmqUNqTCU9/R0kT/zzBjwBqbPaBtGv3MA hocus@prebuild`;
/** Newline at the end is required */
export const DEFAULT_PREBUILD_SSH_KEY_PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCpPg2bPhNhpZqlDakwlPf0dJE/88wY8Aamz2gbRr9zAAAAAKhNjl2LTY5d
iwAAAAtzc2gtZWQyNTUxOQAAACCpPg2bPhNhpZqlDakwlPf0dJE/88wY8Aamz2gbRr9zAA
AAAEBdfLm0JaShomfqS+nSpWe959L8tBV4KyEJW8RJL2TTqKk+DZs+E2GlmqUNqTCU9/R0
kT/zzBjwBqbPaBtGv3MAAAAAImdpdHBvZEBodWdvZHV0a2Etcm9vbXMtb2xhZXA1enZidm
oBAgM=
-----END OPENSSH PRIVATE KEY-----
`;

export const JAILER_USER_ID = 162137;
export const JAILER_GROUP_ID = 162137;
/*
 * Experience showed that paths longer than 102 don't work, even though
 * https://blog.8-p.info/en/2020/06/11/unix-domain-socket-length/ states
 * that the limit is 108.
 */
export const MAX_UNIX_SOCKET_PATH_LENGTH = 102;

export const SOLO_AGENT_INSTANCE_ID = "solo";
export const HOST_PERSISTENT_DIR = "/srv/jailer/resources";

export const PROJECT_DIR = "project";
