#!/bin/bash

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

# Send an optional telemetry event
PHOG_EVENT_NAME=benchmark ENABLE_SENTRY=1 eval "$(cat "$REPO_DIR"/ops/bin/phog-telemetry.hook)"

# First check the OS
if [ "$(uname)" = 'Darwin' ]; then
  echo "Unsupported environment detected. MacOS is not supported due to the lack of KVM support."
  echo "Hocus currently only works on Linux 🐧."
  echo "Please deploy Hocus on a Linux 🐧 server and then use it from the web interface using any web browser"
  echo "For a demo deployment please reach out to the founders in the Hocus Slack"
  exit 1
fi

if [ -f "/proc/sys/fs/binfmt_misc/WSLInterop" ]; then
  echo "Unsupported environment detected. WSL 2.0 is not supported due to https://github.com/microsoft/WSL/issues/9511."
  echo "Hocus currently only works on Linux 🐧."
  echo "Please deploy Hocus on a Linux 🐧 server and then use it from the web interface using any web browser"
  echo "For a demo deployment please reach out to the founders in the Hocus Slack"
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
KVM_DIAG=$(${REPO_DIR}/ops/bin/kvm-ok 2>/dev/null)
if ! [[ $? -eq 0 ]]; then
  echo "😭 $KVM_DIAG"
  exit 1
fi

# Ok Hocus should work on this machine - time to check for software dependencies
# First check if docker is installed on the system
docker -v &>/dev/null
if ! [[ $? -eq 0 ]]; then
  echo "Looks like docker is not installed 😭"
  echo "Try running one of the following commands to install it:"
  echo "Ubuntu/Debian: curl https://get.docker.com/ | sudo bash -"
  echo "Arch/Manjaro: sudo pacman -S docker"
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
  echo "Ubuntu/Debian: sudo apt-get install docker-buildx-plugin"
  echo "Arch/Manjaro: sudo pacman -S docker-buildx"
  exit 1
fi

# Now check if docker compose is installed on the platform :)
docker compose version &>/dev/null
if ! [[ $? -eq 0 ]]; then
  echo "Looks like docker compose is not installed 😭"
  echo "Try running one of the following commands to install it:"
  echo "Ubuntu/Debian: sudo apt-get install docker-compose-plugin"
  echo "Arch/Manjaro: sudo pacman -S docker-compose"
  exit 1
fi

cd "$SCRIPT_DIR"

fatal_error () {
  echo -e "Please report this problem here"
  echo -e "🙏🙏🙏 \033[0;32m https://github.com/hocus-dev/hocus/issues/new/choose \033[0m 🙏🙏🙏"
  echo "We will get you a 🦝 to help you as quickly as possible"
  exit 1
}

build_service () {
  BUILD_OUTPUT=""
  T0=$(date +%s%N | cut -b1-13)
  # Stream the output of docker build line by line
  while read docker_line;
  do
    # Buffer the whole docker build output
    BUILD_OUTPUT+="$docker_line"$'\n'
    # Check if the build failed
    if grep -q -e "ERROR" -e "CANCELED" <<< "$docker_line"; then
      ERROR_PRESENT="YES"
    fi
    # Display a custom progress indicator if there is no error
    if [[ ! -v ERROR_PRESENT ]]; then
      if grep -q -e "^#[0-9]*" <<< "$docker_line"; then
        T1=$(date +%s%N | cut -b1-13)
        DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
        STEP=$(grep -o -e "^#[0-9]*" <<< "$docker_line")
        echo -en "\r\033[KBuilding $2 step $STEP elapsed $DT s "
      fi
    fi
  done < <($REPO_DIR/ops/bin/local-cmd.sh build --progress=plain $1 2> /dev/null)

  # If an error in the build is present then display the whole log
  if [[ -v ERROR_PRESENT ]]; then
    T1=$(date +%s%N | cut -b1-13)
    DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
    echo -e "\r\033[KBuilding $2 failed in $DT s ❌\n"

    echo -e "$BUILD_OUTPUT" | grep --color=always -E '^|ERROR:.*'
    echo "We were unable to build Hocus 😭"
    echo "Above you will find the docker build logs with the errors highlighted"
    fatal_error
  else
    T1=$(date +%s%N | cut -b1-13)
    DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
    echo -e "\r\033[KBuilding $2 done in $DT s ✅"
  fi
}

if [ -z ${HOCUS_BUILD_COMMIT_HASH+x} ]; then
  # Building images
  echo "Building docker images 👷📦"
  build_service hocus-agent agent
fi;

NO_EXPOSE_PORTS=1 $REPO_DIR/ops/bin/local-cmd.sh run -it --rm hocus-agent
