#!/bin/bash
set -e

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

cd "$SCRIPT_DIR"

echo "🔄 Starting Docker build..."
docker build -t worker-dev -f "$REPO_DIR/ops/docker/worker.Dockerfile" "$REPO_DIR/ops/docker"
echo "✅ Docker build complete"
docker run \
  -it \
  --rm \
  --privileged \
  -v "$REPO_DIR:/app" \
  -v "$HOCUS_RESOURCES_DIR:/hocus-resources" \
  -v /dev/kvm:/dev/kvm \
  -p 2222:22 \
  --name agent \
  worker-dev \
  /bin/bash -c \
  "ops/docker/resources/worker-dev-entrypoint.sh && TEMPORAL_ADDRESS=\$GITPOD_IP:7233 /bin/bash"
