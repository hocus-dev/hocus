#!/bin/bash
# Build a filesystem for a VM using Docker.

set -o errexit
set -o pipefail
set -o xtrace

if [ -z "${1}" ] || [ -z "${2}" ] || [ -z "${3}" ] || [ -z "${4}" ]; then
    echo "Usage: ${0} DOCKERFILE_PATH OUTPUT_PATH CONTEXT_DIR FS_MAX_SIZE_MIB"
    exit 1
fi

set -o nounset

DOCKERFILE_PATH="$(realpath ${1})"
OUTPUT_PATH="$(realpath ${2})"
CONTEXT_DIR="$(realpath ${3})"
FS_MAX_SIZE_MIB="${4}"

IMAGE_TAG=$(basename "$DOCKERFILE_PATH" | sed 's/\.Dockerfile//')
IMAGE_NAME="buildfs:${IMAGE_TAG}"
OCI_DUMP_DIR=./test
OCI_DUMP_DIR2=./test2

# Build the image - is instant if the image already exists :)
docker build --progress=plain --tag "${IMAGE_NAME}" --file "${DOCKERFILE_PATH}" "${CONTEXT_DIR}"
IMAGE_HASH=$(docker images --no-trunc --digests --quiet "${IMAGE_NAME}" | tr -d '\n')
if [ -f "$OCI_DUMP_DIR"/manifest.json ]; then
    EXISTING_IMAGE_HASH=$(jq .config.digest < "$OCI_DUMP_DIR"/manifest.json | tr -d '"' | tr -d '\n')
    echo "Found existing image dump with hash $EXISTING_IMAGE_HASH, target hash $IMAGE_HASH"
    if [ "$IMAGE_HASH" = "$EXISTING_IMAGE_HASH" ]; then
        echo "Skipping image dump - hashes the same";
    else
        skopeo copy --dest-decompress --dest-oci-accept-uncompressed-layers docker-daemon:"${IMAGE_NAME}" oci:"$OCI_DUMP_DIR"
    fi
else
    skopeo copy --dest-decompress --dest-oci-accept-uncompressed-layers docker-daemon:"${IMAGE_NAME}" oci:"$OCI_DUMP_DIR"  
fi

/opt/overlaybd/convertor -r local-directory -i "$OCI_DUMP_DIR" -o "$OCI_DUMP_DIR2"

exit 1

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
mkfs.ext4 "${OUTPUT_PATH}"

docker container create --name "${CONTAINER_NAME}" "${IMAGE_NAME}"

mkdir -p "${MOUNT_PATH}"
mount "${OUTPUT_PATH}" "${MOUNT_PATH}"
cd "${MOUNT_PATH}"
docker container export "${CONTAINER_NAME}" | tar -xf -
cd "${ORIGINAL_PATH}"
umount "${MOUNT_PATH}"
e2label "${OUTPUT_PATH}" "${FS_HASH}"
