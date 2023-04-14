#!/bin/bash

set -e

SCRIPT_PATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
PROJECT_DIR=$(dirname $(dirname "$SCRIPT_PATH"))

# These env variables help with caching
export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1

cd "$PROJECT_DIR""/ops/docker" &&
    docker compose \
        -p rooms \
        up -d
# postgres needs a second to start up
sleep 1
cd "$PROJECT_DIR" && \
    yarn prisma migrate deploy
