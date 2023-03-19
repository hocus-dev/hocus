#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

ops/docker/resources/setup-network.sh
yarn
ops/bin/link.sh
source ops/resources/gitpod-ip.sh
export DB_HOST="db"
export AGENT_TEMPORAL_ADDRESS="$GITPOD_IP:7233"
export TEMPORAL_SERVER_URL="$GITPOD_IP:7233"
export AGENT_DATABASE_URL="postgres://postgres:pass@$GITPOD_IP:5432/rooms"

NODE_ENV=development AGENT_SETUP_HOCUS_DEV_ENV=true yarn ts-node -r tsconfig-paths/register entrypoints/agent.ts || true

/bin/bash
