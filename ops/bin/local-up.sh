#!/bin/bash

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../..")"
export HOCUS_RESOURCES_DIR="$(realpath ${REPO_DIR}/../hocus-resources)"

# Send an optional telemetry event
PHOG_EVENT_NAME=local-up ENABLE_SENTRY=1 eval "$(cat "$REPO_DIR"/ops/bin/phog-telemetry.hook)"

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

if [[ -z $(git status -s) ]]; then
export HOCUS_BUILD_COMMIT_HASH=$(git rev-parse HEAD)
fi

# TODO: ensure this is set
export HOCUS_DEV_GIT_NAME=$(git config --get user.name || echo "dev")
export HOCUS_DEV_GIT_EMAIL=$(git config --get user.email || echo "dev@example.com")

if [[ ! -v HOCUS_HOSTNAME ]]; then
  echo "HOCUS_HOSTNAME was not set. Set it to a domain where you may reach this machine."
  echo "If running locally then set to localhost, if via tailscale then set it to the MagicDNS domain of the machine."
  echo -e "\nHOCUS_HOSTNAME=localhost ./ops/bin/local-up.sh\n"
  echo "If you need to change the domain please delete the data first ./ops/bin/local-cleanup.sh"
  echo "If you want to migrate to another hostname inplace without deleting the data then you need to modify the Hocus keycloak realm!"
  exit 1
fi

export HOCUS_DEV_GIT_NAME=$(git config --get user.name)
export HOCUS_DEV_GIT_EMAIL=$(git config --get user.email)

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
  build_service setup-keycloak db-autosetup
  build_service keycloak keycloak
  build_service temporal-hocus-codec temporal-codec
  build_service hocus-ui ui
  build_service hocus-agent agent
fi;

# Pulling images
echo -n "Pulling docker images 📥"
T0=$(date +%s%N | cut -b1-13)
EXTRA_PULL_FLAGS=
if [ -z ${HOCUS_BUILD_COMMIT_HASH+x} ]; then
  # When building images locally this flag is needed
  EXTRA_PULL_FLAGS=--ignore-buildable
  # Check minimum version of docker compose
  # We require docker compose of at least version 2.15.0 which introduced --ignore-buildable
  COMPOSE_VERSION="$(docker compose version | grep -o -E '[0-9]+(\.[0-9]+){2}$')"
  COMPOSE_REQUIRED_VERSION="2.15.0"
  if ! [ "$(printf '%s\n' "$COMPOSE_REQUIRED_VERSION" "$COMPOSE_VERSION" | sort -V | head -n1)" = "$COMPOSE_REQUIRED_VERSION" ]; then
    T1=$(date +%s%N | cut -b1-13)
    DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
    echo -e "\r\033[KPulling docker images 📥 - ❌ in $DT"
    echo "When building local images Hocus requires docker compose to be least version $COMPOSE_REQUIRED_VERSION, the local version is $COMPOSE_VERSION"
    echo "Consult the docker compose documentation on how to upgrade https://docs.docker.com/compose/install/linux/#install-using-the-repository"
    exit 1
  fi
fi

DOCKER_PULL_LOGS=$("$REPO_DIR"/ops/bin/local-cmd.sh pull $EXTRA_PULL_FLAGS -q 2>&1)
if ! [[ $? -eq 0 ]]; then
  T1=$(date +%s%N | cut -b1-13)
  DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
  echo -e "\r\033[KPulling docker images 📥 - ❌ in $DT"
  echo -e "$DOCKER_PULL_LOGS" | grep -v "variable is not set" | grep --color=always -i -E '^|Bind for.*failed|unhealthy|manifest for .* not found'
  echo -e "\nAbove you will find the logs"
  fatal_error
else
  T1=$(date +%s%N | cut -b1-13)
  DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
  echo -e "\r\033[KPulling docker images 📥 - ✅ in $DT s"
fi

echo -n "Seeding the DB 🌱"
T0=$(date +%s%N | cut -b1-13)
SEED_LOG=$($REPO_DIR/ops/bin/local-cmd.sh run --rm setup-keycloak 2>&1)
if ! [[ $? -eq 0 ]]; then
  T1=$(date +%s%N | cut -b1-13)
  DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
  echo -e "\r\033[KSeeding the DB 🌱 - ❌ in $DT"

  echo -e "$SEED_LOG"
  echo -e "\nAbove you will find the logs"
  fatal_error
else
  T1=$(date +%s%N | cut -b1-13)
  DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
  echo -e "\r\033[KSeeding the DB 🌱 - ✅ in $DT s"
fi

start_service () {
  echo -n "Starting $2"
  T0=$(date +%s%N | cut -b1-13)
  DOCKER_UP_LOGS=$($REPO_DIR/ops/bin/local-cmd.sh up --detach --wait --no-deps $1 2>&1)
  if ! [[ $? -eq 0 ]]; then
    T1=$(date +%s%N | cut -b1-13)
    DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
    echo -e "\r\033[KStarting $2 - ❌ in $DT\n"
    $REPO_DIR/ops/bin/local-cmd.sh logs $1 2> /dev/null
    echo -e "$DOCKER_UP_LOGS" | grep -v "variable is not set" | grep --color=always -i -E '^|Bind for.*failed|unhealthy'
    echo -e "\nAbove you will find the logs"
    fatal_error
  else
    T1=$(date +%s%N | cut -b1-13)
    DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
    echo -e "\r\033[KStarting $2 - ✅ in $DT s"
  fi
}

start_service db "the DB 📙"
start_service keycloak "Keycloak 🔑"
start_service "temporal temporal-admin-tools temporal-ui temporal-hocus-codec" "Temporal ☁️ "
start_service "hocus-ui hocus-agent" "Hocus 🧙🪄 "

echo -e "\nYou may access Hocus here: http://${HOCUS_HOSTNAME}:3000/ Creds: dev/dev"
echo -e "Keycloak: http://${HOCUS_HOSTNAME}:4200/ Creds: admin/admin"
echo -e "Temporal: http://${HOCUS_HOSTNAME}:8080/"

echo -e "\nTo delete all data ./ops/bin/local-cleanup.sh"
echo -e "To get debug logs: ./ops/bin/local-cmd.sh logs"
echo -e "To stop the deploy: ./ops/bin/local-cmd.sh down"
