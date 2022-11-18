#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# Setup the ssh-gateway network namespace
ip netns add ssh-gateway
ip link add veth1 type veth peer name vpeer1
ip link set vpeer1 netns ssh-gateway
ip addr add 10.10.10.10/24 dev veth1
ip netns exec ssh-gateway ip addr add 10.10.10.20/24 dev vpeer1
ip link set veth1 up
ip netns exec ssh-gateway ip link set dev vpeer1 up
