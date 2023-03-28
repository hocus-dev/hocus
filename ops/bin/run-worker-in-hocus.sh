#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export AGENT_REPO_DIR="/home/hocus/dev/project-agent"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"
export DOCKER_COMPOSE_FILE_PATH="${REPO_DIR}/ops/docker/agent-in-hocus.docker-compose.yml"

cd "$SCRIPT_DIR"

echo "🔄 Starting Docker build..."
docker build -t worker-dev -f "$REPO_DIR/ops/docker/hocus-agent-dev.Dockerfile" "$REPO_DIR/ops/docker"
echo "✅ Docker build complete"
docker compose -p agent-in-hocus -f "$DOCKER_COMPOSE_FILE_PATH" down -t 1 || true

export HOCUS_DEV_GIT_NAME="$(git config --get user.name)"
export HOCUS_DEV_GIT_EMAIL="$(git config --get user.email)"

docker compose -p agent-in-hocus -f "$DOCKER_COMPOSE_FILE_PATH" up
