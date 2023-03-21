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
docker build -t worker-dev -f "$REPO_DIR/ops/docker/hocus-agent-dev.Dockerfile" "$REPO_DIR/ops/docker"
echo "✅ Docker build complete"
docker compose -p agentdev -f "$REPO_DIR/ops/docker/agent-dev.docker-compose.yml" up -d

clean_up() {
  docker compose -p agentdev -f "$REPO_DIR/ops/docker/agent-dev.docker-compose.yml" down -t 1
}
trap clean_up INT TERM EXIT

source "$REPO_DIR/ops/resources/gitpod-ip.sh"

export HOCUS_DEV_GIT_NAME=$(git config --get user.name)
export HOCUS_DEV_GIT_EMAIL=$(git config --get user.email)

docker compose -p agentdev exec agent \
  /bin/bash -c "HOCUS_DEV_GIT_NAME=$HOCUS_DEV_GIT_NAME HOCUS_DEV_GIT_EMAIL=$HOCUS_DEV_GIT_EMAIL ops/bin/worker-dev-entrypoint.sh"
