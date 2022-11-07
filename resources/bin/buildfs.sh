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

DOCKERFILE_PATH="$(realpath ${1})"
OUTPUT_PATH="$(realpath ${2})"
CONTEXT_DIR="$(realpath ${3})"

# Generate 8 random characters.
IMAGE_TAG="$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 8 || true)"
IMAGE_NAME="buildfs:${IMAGE_TAG}"
CONTAINER_NAME="container-buildfs-${IMAGE_TAG}"
ORIGINAL_PATH="$(pwd)"

clean_up() {
    echo "Cleaning up..."
    cd "${ORIGINAL_PATH}"
    docker rm "${CONTAINER_NAME}" || true
}

trap clean_up INT TERM EXIT

docker build --tag "${IMAGE_NAME}" --file "${DOCKERFILE_PATH}" "${CONTEXT_DIR}"
docker container create --name "${CONTAINER_NAME}" "${IMAGE_NAME}"

cd "${OUTPUT_PATH}"
docker container export "${CONTAINER_NAME}" | tar -xf -
