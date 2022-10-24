#!/bin/bash
set -e

echo "🔄 Starting Docker build..."
docker build -t worker-dev -f ops/docker/worker.Dockerfile .
echo "✅ Docker build complete"
docker run -it --rm -v $(pwd):/app worker-dev /bin/bash -c \
  "yarn && ops/bin/link.sh && source ops/resources/gitpod-ip.sh && TEMPORAL_ADDRESS=\$GITPOD_IP:7233 /bin/bash"
