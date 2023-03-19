#!/bin/bash
# Build a filesystem for a VM using Docker.

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

DOCKERFILE_PATH="$(realpath ${1})"
OUTPUT_PATH="$(realpath ${2})"
CONTEXT_DIR="$(realpath ${3})"
FS_MAX_SIZE_MIB="${4}"

if [ -z "${DOCKERFILE_PATH}" ] || [ -z "${OUTPUT_PATH}" ] || [ -z "${CONTEXT_DIR}" ] || [ -z "${FS_MAX_SIZE_MIB}" ]; then
    echo "Usage: ${0} DOCKERFILE_PATH OUTPUT_PATH CONTEXT_DIR FS_MAX_SIZE_MIB"
    exit 1
fi

IMAGE_TAG=$(basename "$DOCKERFILE_PATH" | sed 's/\.Dockerfile//')
IMAGE_NAME="buildfs:${IMAGE_TAG}"
CONTAINER_NAME="container-buildfs-${IMAGE_TAG}"
MOUNT_PATH="/tmp/buildfs-${IMAGE_TAG}"
ORIGINAL_PATH="$(pwd)"

# Build the image - is instant if the image already exists :)
docker build --tag "${IMAGE_NAME}" --file "${DOCKERFILE_PATH}" "${CONTEXT_DIR}"
FS_HASH=$(docker images --no-trunc --digests --quiet "${IMAGE_NAME}" | tr -d '\n' | tail -c16)

# If the target image already exists
if [ -f "${OUTPUT_PATH}" ]; then
    EXISTING_FS_HASH=$(blkid -s LABEL -o value ${OUTPUT_PATH})
    echo "Found existing FS with hash $EXISTING_FS_HASH, target hash $FS_HASH"
    if [ "$FS_HASH" = "$EXISTING_FS_HASH" ]; then
        echo "Skipping - hashes the same";
        exit 0
    fi
fi

clean_up() {
    echo "Cleaning up..."
    cd "${ORIGINAL_PATH}"
    docker rm "${CONTAINER_NAME}" || true
    umount "${MOUNT_PATH}" || true
    rm -r "${MOUNT_PATH}" || true
}

trap clean_up INT TERM EXIT

rm -f "${OUTPUT_PATH}"
dd if=/dev/zero of="${OUTPUT_PATH}" bs=1M count=0 seek="${FS_MAX_SIZE_MIB}"
mkfs.ext4 -L "${FS_HASH}" "${OUTPUT_PATH}"

docker container create --name "${CONTAINER_NAME}" "${IMAGE_NAME}"

mkdir -p "${MOUNT_PATH}"
mount "${OUTPUT_PATH}" "${MOUNT_PATH}"
cd "${MOUNT_PATH}"
docker container export "${CONTAINER_NAME}" | tar -xf -
