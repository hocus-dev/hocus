#!/bin/bash

set -o errexit
set -o pipefail

if [[ "$TARGET" != "workspace" && "$TARGET" != "workspace-base" ]]; then
  echo "TARGET must be workspace or workspace-base"
  exit 1
fi
if [[ -z "$NAME" ]]; then
  echo "NAME must be set"
  exit 1
fi

set -o nounset

export DOCKER_BUILDKIT=1

LABEL=$(date +"%d-%m-%Y")
TAG="$NAME:$LABEL"
TAG_LATEST="$NAME:latest"

docker build --tag "$TAG" --target workspace --file workspace.Dockerfile resources
docker tag "$TAG" "$TAG_LATEST"
docker push "$TAG"
docker push "$TAG_LATEST"
