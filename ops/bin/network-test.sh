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
    timeout 0.05 ping -c 1 "$address" > /dev/null
  else
    ip netns exec "$netns" timeout 0.05 ping -c 1 "$address" > /dev/null
  fi
}

# Setup a namespace that will pose as a vm spawned by the agent
ip netns del ns-hocusvm0 || true
ip link delete hocusvm-tap0 || true
ip link delete vpeer-hocusvm0 || true
ip netns add ns-hocusvm0
ip netns exec vms ip link delete hocusvm-tap0 || true
ip netns exec ns-hocusvm0 ip link delete vpeer-hocusvm0 || true

ip link add hocusvm-tap0 type veth peer name vpeer-hocusvm0
ip link set hocusvm-tap0 netns vms
ip link set vpeer-hocusvm0 netns ns-hocusvm0
ip netns exec vms ip addr add 10.231.0.4/31 dev hocusvm-tap0
ip netns exec ns-hocusvm0 ip addr add 10.231.0.5/16 dev vpeer-hocusvm0
ip netns exec vms ip link set hocusvm-tap0 up
ip netns exec ns-hocusvm0 ip link set vpeer-hocusvm0 up
ip netns exec ns-hocusvm0 ip route add default via 10.231.0.5

ip netns exec vms sysctl -w net.ipv4.conf.hocusvm-tap0.proxy_arp=1
ip netns exec vms sysctl -w net.ipv6.conf.hocusvm-tap0.disable_ipv6=1


reach 10.10.0.1
reach 10.231.0.1
reach 127.0.0.1
reach 172.17.0.3 vms
reach 10.231.0.0 vms
reach 10.231.0.1 ns-hocusvm0
reach 10.231.0.0 ns-hocusvm0
reach 172.17.0.3 ns-hocusvm0

expect_fail reach 10.10.0.0 ssh
expect_fail reach 10.231.0.5 ssh
