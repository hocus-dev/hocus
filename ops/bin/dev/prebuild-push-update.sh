#!/bin/bash
set -o pipefail
set -o xtrace
set -o errexit

export DOCKER_BUILDKIT=1

# We redeploy hocus way too often, obd takes a long time to compile
# Temporarily just push some images we need to quay
export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"

"$REPO_DIR"/ops/bin/dev/quay-login.sh
QUAY_REPO=quay.io/hocus/hocus-prebuilds
docker build --push -f "$REPO_DIR"/ops/docker/prebuilds.Dockerfile "$REPO_DIR"/ops/docker/resources --target obd-prebuild -t "$QUAY_REPO-obd"
docker build --push -f "$REPO_DIR"/ops/docker/prebuilds.Dockerfile "$REPO_DIR"/ops/docker/resources --target obd-convertor-prebuild -t "$QUAY_REPO-obd-convertor"
docker build --push -f "$REPO_DIR"/ops/docker/prebuilds.Dockerfile "$REPO_DIR"/ops/docker/resources --target hocus-workspace-prebuild -t "$QUAY_REPO-hocus-workspace"
docker build --push -f "$REPO_DIR"/ops/docker/prebuilds.Dockerfile "$REPO_DIR"/ops/docker/resources --target agent-dev-prebuild -t "$QUAY_REPO-agent-dev"

#OBD_REF=$(docker inspect --format='{{index .RepoDigests 0}}' "$QUAY_REPO-obd")
#OBD_CONVERTOR_REF=$(docker inspect --format='{{index .RepoDigests 0}}' "$QUAY_REPO-obd-convertor")
WORKSPACE_REF=$(docker inspect --format='{{index .RepoDigests 0}}' "$QUAY_REPO-hocus-workspace")
AGENT_DEV_REF=$(docker inspect --format='{{index .RepoDigests 0}}' "$QUAY_REPO-agent-dev")

# Update tags
sed -i "s%quay\.io.*@sha256:[a-f0-9]*%$WORKSPACE_REF%g" "$REPO_DIR"/hocus.Dockerfile
sed -i "s%quay\.io.*@sha256:[a-f0-9]*%$AGENT_DEV_REF%g" "$REPO_DIR"/ops/docker/agent-tests.Dockerfile
sed -i "s%quay\.io.*@sha256:[a-f0-9]*%$AGENT_DEV_REF%g" "$REPO_DIR"/ops/docker/hocus-agent-dev.Dockerfile
