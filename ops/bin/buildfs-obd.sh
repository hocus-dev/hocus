#!/bin/bash
# Build a filesystem for a VM using Docker.

set -o errexit
set -o pipefail
set -o xtrace

if [ -z "${1}" ] || [ -z "${2}" ] || [ -z "${3}" ]; then
    echo "Usage: ${0} DOCKERFILE_PATH OUTPUT_PATH CONTEXT_DIR"
    exit 1
fi

set -o nounset

DOCKERFILE_PATH="$(realpath "${1}")"
OUTPUT_PATH="$(realpath "${2}")"
CONTEXT_DIR="$(realpath "${3}")"

IMAGE_TAG=$(basename "$DOCKERFILE_PATH" | sed 's/\.Dockerfile//')
IMAGE_NAME="buildfs:${IMAGE_TAG}"
OCI_DUMP_DIR_TAR="$OUTPUT_PATH/tmp"
OCI_DUMP_DIR_OBD="$OUTPUT_PATH"

mkdir "$OCI_DUMP_DIR_OBD" || true

# Build the image - is instant if the image already exists :)
docker build --progress=plain --tag "${IMAGE_NAME}" --file "${DOCKERFILE_PATH}" "${CONTEXT_DIR}"
skopeo copy --dest-decompress --dest-oci-accept-uncompressed-layers docker-daemon:"${IMAGE_NAME}" oci:"$OCI_DUMP_DIR_TAR"
/opt/overlaybd/bin/convertor -r local-directory -i "$OCI_DUMP_DIR_TAR" -o "$OCI_DUMP_DIR_OBD"
chmod gua+rw "$OCI_DUMP_DIR_OBD/index.json"
