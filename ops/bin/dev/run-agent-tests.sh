#!/bin/bash

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"
export RESOURCES_DIR=$REPO_DIR/../hocus-resources/resources

if ! [[ -f $RESOURCES_DIR/test-buildfs.ext4 ]]; then
  $REPO_DIR/ops/bin/dev/build-test-buildfs.sh "$RESOURCES_DIR"
fi

# Detect agent
AGENT_CONTAINER=$(docker ps | grep worker-dev | grep -o -e '^[0-9a-f]*')
if ! [[ $? -eq 0 ]]; then
  echo "Start the dev agent first ./ops/bin/dev/run-worker.sh"
  exit 1
fi

set -o errexit
set -o pipefail
set -o nounset
docker exec -it $AGENT_CONTAINER bash -c "yarn test:agent"
