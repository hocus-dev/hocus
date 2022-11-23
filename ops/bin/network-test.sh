#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

expect_fail() {
  "$@" && exit 1 || true
}

reach() {
  local address="$1"
  local netns="${2:-""}"
  local timeout_secs="${3:-"0.2"}"
  if [ -z "$netns" ]; then
    timeout "$timeout_secs" ping -c 1 "$address" > /dev/null
  else
    ip netns exec "$netns" timeout "$timeout_secs" ping -c 1 "$address" > /dev/null
  fi
}

SSH_NS_HOST_IF_IP="10.10.0.2"
VMS_NS_HOST_IF_IP="10.231.0.2"
HOST_IP="$(ip addr show eth0 | grep -Po 'inet \K[\d.]+')"
HOST_NS_VMS_IF_IP="10.231.0.1"
HOST_NS_SSH_IF_IP="10.10.0.1"
VM0_NS_VMS_IF_IP="10.231.0.10"

reach "$SSH_NS_HOST_IF_IP"
reach "$VMS_NS_HOST_IF_IP"
reach 127.0.0.1
reach "$HOST_IP" vms
reach "$HOST_NS_VMS_IF_IP" ns-hocusvm0 5
reach "$VMS_NS_HOST_IF_IP" ns-hocusvm0 5
reach "$HOST_IP" ns-hocusvm0 5
reach google.com ns-hocusvm0 5

expect_fail reach "$HOST_NS_SSH_IF_IP" ssh
expect_fail reach "$VM0_NS_VMS_IF_IP" ssh
