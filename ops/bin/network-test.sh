#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

expect_fail() {
  "$@" && exit 1 || true
}

reach() {
  local address="$1"
  local netns="${2:-""}"
  local timeout_secs="${3:-"0.2"}"
  if [ -z "$netns" ]; then
    timeout "$timeout_secs" ping -c 1 "$address" >> /dev/null 2>&1
  else
    ip netns exec "$netns" timeout "$timeout_secs" ping -c 1 "$address" >> /dev/null 2>&1
  fi
}

SSH_NS_HOST_IF_IP="10.10.0.2"
SSH_NS_VMS_IF_IP="10.231.0.5"

VMS_NS_HOST_IF_IP="10.231.0.2"

HOST_IP="$(ip addr show eth0 | grep -Po 'inet \K[\d.]+')"
HOST_NS_VMS_IF_IP="10.231.0.1"
HOST_NS_SSH_IF_IP="10.10.0.1"

VMS_NS_VM0_IF_IP="10.231.0.9"
VM0_NS_VMS_IF_IP="10.231.0.10"

VMS_NS_VM1_IF_IP="10.231.0.13"
VM1_NS_VMS_IF_IP="10.231.0.14"

COMMANDS=$(cat << EOM
reach 127.0.0.1
reach "$VM0_NS_VMS_IF_IP" "" 2
reach "$VM1_NS_VMS_IF_IP" "" 2
expect_fail reach "$VMS_NS_HOST_IF_IP" "" 2

reach google.com ns-hocusvm0 5
expect_fail reach "$HOST_IP" ns-hocusvm0 2
expect_fail reach "$HOST_NS_VMS_IF_IP" ns-hocusvm0 2
expect_fail reach "$SSH_NS_VMS_IF_IP" ns-hocusvm0 2
expect_fail reach "$SSH_NS_HOST_IF_IP" ns-hocusvm0 2

reach google.com ns-hocusvm1 5
expect_fail reach "$HOST_IP" ns-hocusvm1 2
expect_fail reach "$HOST_NS_VMS_IF_IP" ns-hocusvm1 2
expect_fail reach "$SSH_NS_VMS_IF_IP" ns-hocusvm1 2
expect_fail reach "$SSH_NS_HOST_IF_IP" ns-hocusvm1 2

reach "$VM0_NS_VMS_IF_IP" ssh 2
expect_fail reach "$VM1_NS_VMS_IF_IP" ssh 2
expect_fail reach "$HOST_NS_SSH_IF_IP" ssh 2
expect_fail reach "$HOST_IP" ssh 2
EOM
)

# Remove blank lines
COMMANDS="$(echo "$COMMANDS" | sed '/^\s*$/d')"

# Split commands into array by newline
readarray -t COMMANDS <<<"$COMMANDS"

export -f reach
export -f expect_fail

PIDS=()
for CMD in "${COMMANDS[@]}"; do
  bash -c "$CMD" &
  PIDS+=("$!")
done

FAILED=()
for IDX in "${!COMMANDS[@]}"; do
  COMMAND="${COMMANDS[$IDX]}"
  echo "🔄 $COMMAND"
  wait "${PIDS[$IDX]}" || FAILED+=("$IDX")
done

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "❌ Failed commands:"
  for IDX in "${FAILED[@]}"; do
    echo "❗️ ${COMMANDS[$IDX]}"
  done
  exit 1
fi

echo "✅ All commands succeeded"
