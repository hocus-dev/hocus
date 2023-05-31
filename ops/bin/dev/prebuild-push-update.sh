#!/bin/bash
set -o pipefail
set -o xtrace
set -o errexit

export DOCKER_BUILDKIT=1

# We redeploy hocus way too often, obd takes a long time to compile
# Temporarily just push some images we need to quay
SCRIPT_DIR="$(dirname "$0")"
REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"
QUAY_REPO=quay.io/hocus/hocus-prebuilds
TARGETS=("obd" "obd-convertor" "hocus-workspace" "agent-dev")
TARGET_TAGS=()

"$REPO_DIR"/ops/bin/dev/quay-login.sh

for ((i=0; i<${#TARGETS[@]}; i++)); do
  TARGET=${TARGETS[$i]}
  TAG=$(openssl rand -hex 4)
  docker build -f "$REPO_DIR"/ops/docker/prebuilds.Dockerfile "$REPO_DIR"/ops/docker/resources --target "$TARGET" -t "$TAG"
  HASH=$(docker inspect --format='{{index .Id}}' "$TAG" | sed 's/.*:\(.*\)/\1/')
  FINAL_TAG="$QUAY_REPO-$TARGET":"$HASH"
  docker image tag "$TAG" "$FINAL_TAG"
  docker push "$FINAL_TAG"
  TARGET_TAGS+=("$FINAL_TAG")
done

WORKSPACE_TAG=${TARGET_TAGS[2]}
AGENT_DEV_TAG=${TARGET_TAGS[3]}

# Update tags
sed -i "s|FROM quay.io.*|FROM ${WORKSPACE_TAG}|g" "$REPO_DIR"/hocus.Dockerfile
sed -i "s|FROM quay.io.*|FROM ${AGENT_DEV_TAG}|g" "$REPO_DIR"/ops/docker/agent-tests.Dockerfile
sed -i "s|FROM quay.io.*|FROM ${AGENT_DEV_TAG}|g" "$REPO_DIR"/ops/docker/hocus-agent-dev.Dockerfile
