#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

if [[ ! -v HOCUS_HOSTNAME ]]; then
  echo "HOCUS_HOSTNAME was not set. Set it to a domain where you may reach this machine."
  echo "If running locally then set to localhost, if via tailscale then set it to the MagicDNS domain of the machine."
  echo "HOCUS_HOSTNAME=localhost ./ops/bin/hocus-dev-start.sh"
  echo "If you need to change the domain please delete the data first ./ops/bin/hocus-dev-delete-data.sh"
  echo "If you want to migrate inplace without deleting data then you need to modify the Hocus keycloak realm!"
  exit 1
fi

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

if [[ $(file --mime-type -b ${REPO_DIR}/public/user-icon.jpg) == text/plain ]]; then
  echo "You forgot to checkout the assets in LFS. Running it for you..."
  git lfs install
  git lfs fetch --all
  git lfs pull
fi

cd "$SCRIPT_DIR"

docker-compose -p hocus-complete -f "$REPO_DIR/ops/docker/hocus-dev-complete.yml" up --build
