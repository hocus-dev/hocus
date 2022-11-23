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
  if [ -z "$netns" ]; then
    timeout 1 ping -c 1 "$address" > /dev/null
  else
    ip netns exec "$netns" timeout 1 ping -c 1 "$address" > /dev/null
  fi
}


reach 10.10.0.2
reach 10.231.0.2
reach 127.0.0.1
reach 172.17.0.3 vms
reach 10.231.0.1 ns-hocusvm0
reach 10.231.0.2 ns-hocusvm0
reach 172.17.0.3 ns-hocusvm0
reach google.com ns-hocusvm0

expect_fail reach 10.10.0.1 ssh
expect_fail reach 10.231.0.10 ssh
