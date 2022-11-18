#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# Setup the ssh-gateway network namespace
ip netns add ssh-gateway
ip link add veth-public type veth peer name vpeer-public
ip link add veth-private type veth peer name vpeer-private
ip link set vpeer-public netns ssh-gateway
ip link set vpeer-private netns ssh-gateway
ip netns exec ssh-gateway ip addr add 10.230.0.3/24 dev vpeer-public
ip netns exec ssh-gateway ip addr add 10.231.0.3/16 dev vpeer-private
ip addr add 10.230.0.2/24 dev veth-public
ip addr add 10.229.0.2/24 dev veth-private
ip link set veth-public up
ip link set veth-private up
ip netns exec ssh-gateway ip link set dev vpeer-public up
ip netns exec ssh-gateway ip link set dev vpeer-private up

ip netns exec ssh-gateway service ssh start
