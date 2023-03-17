#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

cd "$SCRIPT_DIR"

docker-compose -p hocus-complete -f "$REPO_DIR/ops/docker/hocus-dev-complete.yml" down -v
