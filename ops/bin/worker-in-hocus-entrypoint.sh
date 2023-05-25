#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

ops/docker/resources/setup-network.sh

export DB_HOST="db"
export AGENT_TEMPORAL_ADDRESS="temporal:7233"
export TEMPORAL_SERVER_URL="temporal:7233"
export AGENT_DATABASE_URL="postgres://postgres:pass@db:5432/rooms"
export AGENT_DEV_CREATE_DEVELOPMENT_PROJECTS="true"
export NODE_ENV="development"

yarn run regen
yarn ts-node -r tsconfig-paths/register entrypoints/agent.ts
