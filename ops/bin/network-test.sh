#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

expect_fail() {
  "$@" && exit 1 || true
}

httptest() {
  local address="$1"
  local netns="${2:-""}"
  if [ -z "$netns" ]; then
    curl -s -m 1 "$address" > /dev/null
  else
    ip netns exec "$netns" curl -s -m 1 "$address" > /dev/null
  fi
}

# Setup a namespace that will act as a vm spawned by the agent
ip netns del hocusvm0 || true
ip link delete veth-hocusvm0 || true
ip link delete vpeer-hocusvm0 || true
ip netns add hocusvm0
ip netns exec vms ip link delete veth-hocusvm0 || true
ip netns exec hocusvm0 ip link delete vpeer-hocusvm0 || true

ip link add veth-hocusvm0 type veth peer name vpeer-hocusvm0
ip link set veth-hocusvm0 netns vms
ip link set vpeer-hocusvm0 netns hocusvm0
ip netns exec vms ip addr add 10.231.0.4/31 dev veth-hocusvm0
ip netns exec hocusvm0 ip addr add 10.231.0.5/16 dev vpeer-hocusvm0
ip netns exec vms ip link set veth-hocusvm0 up
ip netns exec hocusvm0 ip link set vpeer-hocusvm0 up

killall python3 || true

ip netns exec ssh python3 -m http.server -b 10.10.0.1 &
ip netns exec vms python3 -m http.server -b 10.231.0.1 &
ip netns exec hocusvm0 python3 -m http.server -b 10.231.0.5 &
python3 -m http.server -b 0.0.0.0 &
sleep 1


httptest 10.10.0.1:8000
httptest 10.231.0.1:8000
httptest 127.0.0.1:8000
httptest 10.231.0.5:8000 vms

expect_fail httptest 10.10.0.0:8000 ssh
expect_fail httptest 10.231.0.5:8000 ssh

killall python3
