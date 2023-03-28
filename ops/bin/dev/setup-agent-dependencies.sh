#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"

/bin/bash "$REPO_DIR/ops/bin/dev/build-vm-images.sh" "/home/hocus/dev/hocus-resources/resources"
/bin/bash "$REPO_DIR/ops/bin/dev/download-kernel.sh" "/home/hocus/dev/hocus-resources/resources"
