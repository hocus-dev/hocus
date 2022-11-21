#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# Setup the ssh-gateway network namespace
ip netns add ssh-gateway
ip link add veth-ssh type veth peer name vpeer-ssh
ip link set vpeer-ssh netns ssh-gateway
ip netns exec ssh-gateway ip addr add 10.231.0.1/16 dev vpeer-ssh
ip addr add 10.231.0.0/31 dev veth-ssh
ip link set veth-ssh up
ip netns exec ssh-gateway ip link set dev vpeer-ssh up

ip netns exec ssh-gateway service ssh start

sysctl -w net.ipv4.conf.veth-ssh.proxy_arp=1
sysctl -w net.ipv6.conf.veth-ssh.disable_ipv6=1

iptables -A FORWARD -i veth-ssh -o veth-python -j ACCEPT
iptables -A FORWARD -i veth-python -o veth-ssh -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -t nat -A POSTROUTING -o veth-python -j MASQUERADE

iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 22 -j DNAT --to-destination 10.231.0.1:22
iptables -t nat -A POSTROUTING -o veth-ssh -j MASQUERADE
