#!/bin/bash

set -e

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
PROJECT_DIR=$(dirname $(dirname "$SCRIPTPATH"))

git lfs pull

# These env variables help with caching
export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1

cd "$PROJECT_DIR""/ops/docker" &&
    docker-compose \
        -p rooms \
        pull
cd "$PROJECT_DIR""/ops/docker" &&
    docker-compose \
        -p rooms \
        build
cd "$PROJECT_DIR" && npx prisma generate
cd "$PROJECT_DIR""/ops/docker" &&
    docker-compose \
        --file temporal.docker-compose.yml \
        -p temporal \
        pull
