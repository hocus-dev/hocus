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
KVM_DIAG=$(${REPO_DIR}/ops/bin/kvm-ok 2>/dev/null)
if ! [[ $? -eq 0 ]]; then
  echo "😭 $KVM_DIAG"
  exit 1
fi

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

fatal_error () {
  echo -e "Please report this problem here"
  echo -e "🙏🙏🙏 \033[0;32m https://github.com/hugodutka/rooms/issues/new \033[0m 🙏🙏🙏"
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
        echo -en "\r\033[KBuilding $2 step $STEP eslapsed $DT s "
      fi
    fi
  done < <($REPO_DIR/ops/bin/local-cmd.sh build --progress=plain $1 2> /dev/null)

  # If an error in the build is present then display the whole log
  if [[ -v ERROR_PRESENT ]]; then
    T1=$(date +%s%N | cut -b1-13)
    DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
    echo -e "\r\033[KBuilding $2 failed in $DT s ❌\n"

    echo -e "$BUILD_OUTPUT" | grep --color -E '^|ERROR:.*'
    echo "We were unable to build Hocus 😭"
    echo "Above you will find the docker build logs with the errors highlighted"
    fatal_error
  else
    T1=$(date +%s%N | cut -b1-13)
    DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
    echo -e "\r\033[KBuilding $2 done in $DT s ✅"
  fi 
}

# Buidling images
echo "Building docker images 👷"
build_service setup-vm-images vm-builder
build_service setup-keycloak db-autosetup
build_service keycloak keycloak
build_service temporal-hocus-codec temporal-codec
build_service hocus-ui ui
build_service hocus-agent agent

# Pulling images
echo -n "Pulling docker images 📥"
T0=$(date +%s%N | cut -b1-13)
$REPO_DIR/ops/bin/local-cmd.sh pull --ignore-buildable -q 2> /dev/null
if ! [[ $? -eq 0 ]]; then
  T1=$(date +%s%N | cut -b1-13)
  DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
  echo -e "\r\033[KPulling docker images 📥 - ❌ in $DT"
  exit 1
else
  T1=$(date +%s%N | cut -b1-13)
  DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
  echo -e "\r\033[KPulling docker images 📥 - ✅ in $DT s"
fi

echo -n "Building MicroVM's 👷🗜🖥️"
T0=$(date +%s%N | cut -b1-13)
VM_BUILD_LOG=$($REPO_DIR/ops/bin/local-cmd.sh run --rm setup-vm-images 2>&1)
if ! [[ $? -eq 0 ]]; then
  T1=$(date +%s%N | cut -b1-13)
  DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
  echo -e "\r\033[KBuilding MicroVM's 👷🗜🖥️ - ❌ in $DT"

  echo -e "$VM_BUILD_LOG" | grep --color -E '^|ERROR:.*'
  echo -e "\nAbove you will find the vm build logs with the errors highlighted"
  fatal_error
else
  T1=$(date +%s%N | cut -b1-13)
  DT=$(printf %.2f\\n "$(( $T1 - $T0 ))e-3")
  echo -e "\r\033[KBuilding MicroVM's 👷🗜🖥️ - ✅ in $DT s"
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

echo "Starting the DB 📙"
$REPO_DIR/ops/bin/local-cmd.sh up --detach --no-recreate --wait --no-deps db 2> /dev/null
echo "Starting Keycloak 🔑"
$REPO_DIR/ops/bin/local-cmd.sh up --detach --no-recreate --wait --no-deps keycloak 2> /dev/null
echo "Starting Temporal ☁️"
$REPO_DIR/ops/bin/local-cmd.sh up --detach --no-recreate --wait --no-deps temporal 2> /dev/null
$REPO_DIR/ops/bin/local-cmd.sh up --detach --no-recreate --wait --no-deps temporal-admin-tools 2> /dev/null
$REPO_DIR/ops/bin/local-cmd.sh up --detach --no-recreate --wait --no-deps temporal-ui 2> /dev/null
$REPO_DIR/ops/bin/local-cmd.sh up --detach --no-recreate --wait --no-deps temporal-hocus-codec 2> /dev/null
echo "Starting Hocus 🧙‍♂️🪄"
$REPO_DIR/ops/bin/local-cmd.sh up --detach --no-recreate --wait --no-deps hocus-ui 2> /dev/null
$REPO_DIR/ops/bin/local-cmd.sh up --detach --no-recreate --wait --no-deps hocus-agent 2> /dev/null
