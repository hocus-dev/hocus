#!/bin/bash

set -e

PROJECT_DIR=$(dirname $(dirname "$0"))

# These env variables help with caching
export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1

cd "$PROJECT_DIR""/docker" &&
    docker-compose \
        -p rooms \
        up -d

npx prisma migrate deploy
