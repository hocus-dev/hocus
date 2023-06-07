#!/bin/bash
# Pushes an OBD image created with ops/bin/buildfs-obd.sh to a remote registry.

set -o errexit
set -o pipefail

if [ -z "${1}" ] || [ -z "${2}" ]; then
    echo "Usage: ${0} OBD_DUMP_DIR IMAGE_TAG"
    exit 1
fi

set -o nounset
set -o xtrace

SCRIPT_DIR="$(dirname "$0")"
REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"

"$REPO_DIR"/ops/bin/dev/quay-login.sh

OBD_DUMP_DIR="$(realpath "${1}")"
IMAGE_TAG="${2}"

crane push "$OBD_DUMP_DIR" "$IMAGE_TAG"