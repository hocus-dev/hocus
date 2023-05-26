#!/bin/bash
set -o pipefail

export DOCKER_BUILDKIT=1

EXISTING_TOKEN=$(cat ~/.docker/config.json 2>/dev/null | jq '.auths."quay.io".auth' 2>/dev/null)
if [[ ! -f "$HOME/.docker/config.json" ]] || [[ "$EXISTING_TOKEN" = "null" ]]; then
  echo "Logging in"
  docker login quay.io -u gorbak25
fi
echo "Login OK"
