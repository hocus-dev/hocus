#!/bin/bash
set -o errexit
set -o pipefail

export OUTPUT_DIR="$1"
if [ -z "$OUTPUT_DIR" ]; then
    echo "Usage: $0 OUTPUT_DIR"
    exit 1
fi

set -o nounset

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"
export DOCKERFILE_DIR="${REPO_DIR}/resources/docker"

echo "Building VM images in $OUTPUT_DIR"
mkdir -pv "$OUTPUT_DIR"
ops/bin/buildfs.sh "$DOCKERFILE_DIR/checkout-and-inspect.Dockerfile" "$OUTPUT_DIR/checkout-and-inspect.ext4" "$REPO_DIR/resources" 500 
ops/bin/buildfs.sh "$DOCKERFILE_DIR/default-workspace.Dockerfile" "$OUTPUT_DIR/default-workspace.ext4" "$REPO_DIR/resources" 1500 
ops/bin/buildfs.sh "$DOCKERFILE_DIR/buildfs.Dockerfile" "$OUTPUT_DIR/buildfs.ext4" "$REPO_DIR/resources" 1000
ops/bin/buildfs.sh "$DOCKERFILE_DIR/fetchrepo.Dockerfile" "$OUTPUT_DIR/fetchrepo.ext4" "$REPO_DIR/resources" 2500
