#!/bin/bash

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

PHOG_EVENT_NAME=local-cmd eval "$(cat "$REPO_DIR"/ops/bin/phog-telemetry.hook)"

docker compose -p hocus-local -f "$REPO_DIR/ops/docker/hocus-local.yml" "$@"
