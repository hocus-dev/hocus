#!/bin/bash

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

PHOG_EVENT_NAME=local-cmd eval "$(cat "$REPO_DIR"/ops/bin/phog-telemetry.hook)"

EXTRA=$REPO_DIR/ops/docker/hocus-local.images.docker-compose.yml
if [ -z ${HOCUS_BUILD_COMMIT_HASH+x} ]; then
  EXTRA=$REPO_DIR/ops/docker/hocus-local.build.docker-compose.yml
fi

docker compose -p hocus-local -f "$REPO_DIR/ops/docker/hocus-local.common.docker-compose.yml" -f "$EXTRA" "$@"
