#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

PHOG_EVENT_NAME=local-cleanup eval "$(cat "$REPO_DIR"/ops/bin/phog-telemetry.hook)"

cd "$SCRIPT_DIR"
"$REPO_DIR/ops/bin/local-cmd.sh" down -v --remove-orphans
