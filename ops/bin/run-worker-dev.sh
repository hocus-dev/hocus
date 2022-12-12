#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

cd "$SCRIPT_DIR"

echo "🔄 Starting Docker build..."
docker build -t worker-dev -f "$REPO_DIR/ops/docker/worker.Dockerfile" "$REPO_DIR/ops/docker"
echo "✅ Docker build complete"
docker-compose -p agentdev -f "$REPO_DIR/ops/docker/agent-dev.docker-compose.yml" up -d

clean_up() {
  docker-compose -p agentdev -f "$REPO_DIR/ops/docker/agent-dev.docker-compose.yml" down -t 1
}
trap clean_up INT TERM EXIT

source "$REPO_DIR/ops/resources/gitpod-ip.sh"

docker-compose -p agentdev exec agent \
  /bin/bash -c "ops/docker/resources/setup-network.sh && yarn && ops/bin/link.sh && source ops/resources/gitpod-ip.sh && DB_HOST=db TEMPORAL_ADDRESS=$GITPOD_IP:7233 /bin/bash"
