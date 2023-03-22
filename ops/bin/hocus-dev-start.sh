#!/bin/bash

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

# Try to make the script as idiotproof as it gets
# First check if docker is installed on the system
docker -v &>/dev/null
if ! [[ $? -eq 0 ]]; then
  echo "Looks like docker is not installed 😭"
  echo "Try running one of the following commands to install it:"
  echo "Ubuntu/Devian: curl https://get.docker.com/ | sudo bash -"
  echo "Arch/Manjaro: sudo pacman -S docker"
  echo "Windows/macOS: buy/rent some 🐧🐧🐧"
  exit 1
fi

# Then check if we have access to the docker daemon
docker ps &>/dev/null
if ! [[ $? -eq 0 ]]; then
  echo "Looks like you don't have access to the docker daemon 😭"
  echo "Please consult the docker postinstall guide:"
  echo "https://docs.docker.com/engine/install/linux-postinstall/"
  echo "Perhaps you need to relogin to reload groups?"
  exit 1
fi

# Then check if buildx is installed on the platform
docker buildx version &>/dev/null
if ! [[ $? -eq 0 ]]; then
  echo "Looks like buildx is not installed 😭"
  echo "Try running one of the following commands to install it:"
  echo "Ubuntu/Devian: sudo apt-get install docker-buildx-plugin"
  echo "Arch/Manjaro: sudo pacman -S docker-buildx"
  echo "Windows/macOS: buy/rent some 🐧🐧🐧"
  exit 1
fi

# Now check if docker compose is installed on the platform :)
docker compose version &>/dev/null
if ! [[ $? -eq 0 ]]; then
  echo "Looks like docker compose is not installed 😭"
  echo "Try running one of the following commands to install it:"
  echo "Ubuntu/Devian: sudo apt-get install docker-compose-plugin"
  echo "Arch/Manjaro: sudo pacman -S docker-compose"
  echo "Windows/macOS: buy/rent some 🐧🐧🐧"
  exit 1
fi

# Check if the kernel is new enough
KERNEL_SEMVER=$(uname -r)
KERNEL_MAJOR=$(echo $KERNEL_SEMVER | cut -d. -f1)
KERNEL_MINOR=$(echo $KERNEL_SEMVER | cut -d. -f2)
if [[ KERNEL_MAJOR -lt 5 ]] || { [[ KERNEL_MAJOR -eq 5 ]] && [[ KERNEL_MINOR -lt 10 ]]; }; then
  echo "[WARNING] Host kernel *might* be too old. If you encounter issues with nested virtualization please first try running Hocus on at least the 5.10 kernel"
fi

# Now check if KVM is available
KVM_DIAG=$(${REPO_DIR}/ops/bin/kvm-ok)
if ! [[ $? -eq 0 ]]; then
  echo "😭 $KVM_DIAG"
  exit 1
fi

set -o errexit
set -o pipefail
set -o nounset

if [[ ! -v HOCUS_HOSTNAME ]]; then
  echo "HOCUS_HOSTNAME was not set. Set it to a domain where you may reach this machine."
  echo "If running locally then set to localhost, if via tailscale then set it to the MagicDNS domain of the machine."
  echo "HOCUS_HOSTNAME=localhost ./ops/bin/hocus-dev-start.sh"
  echo "If you need to change the domain please delete the data first ./ops/bin/hocus-dev-delete-data.sh"
  echo "If you want to migrate to another hostname inplace without deleting the data then you need to modify the Hocus keycloak realm!"
  exit 1
fi

if [[ $(file --mime-type -b ${REPO_DIR}/public/user-icon.jpg) == text/plain ]]; then
  echo "You forgot to checkout the assets in LFS. Running it for you..."
  git lfs install
  git lfs fetch --all
  git lfs pull
fi

export HOCUS_DEV_GIT_NAME=$(git config --get user.name)
export HOCUS_DEV_GIT_EMAIL=$(git config --get user.email)

cd "$SCRIPT_DIR"

docker compose -p hocus-complete -f "$REPO_DIR/ops/docker/hocus-dev-complete.yml" up --detach --build
