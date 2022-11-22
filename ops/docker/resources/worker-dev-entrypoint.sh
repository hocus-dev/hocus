#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# Setup the vms network namespace
ip netns add vms
ip link add veth-vms type veth peer name vpeer-vms
ip link set vpeer-vms netns vms
ip netns exec vms ip addr add 10.231.0.1/31 dev vpeer-vms
ip addr add 10.231.0.0/16 dev veth-vms
ip link set veth-vms up
ip netns exec vms ip link set dev vpeer-vms up
ip netns exec vms ip route add default via 10.231.0.1

# Setup the ssh network namespace
ip netns add ssh
ip link add veth-ssh type veth peer name vpeer-ssh
ip link set vpeer-ssh netns ssh
ip netns exec ssh ip addr add 10.10.0.1/16 dev vpeer-ssh
ip addr add 10.10.0.0/31 dev veth-ssh
ip link set veth-ssh up
ip netns exec ssh ip link set dev vpeer-ssh up

# Connect the vms network namespace to the ssh network namespace
ip link add veth-ssh-vms type veth peer name vpeer-ssh-vms
ip link set veth-ssh-vms netns ssh
ip link set vpeer-ssh-vms netns vms
ip netns exec ssh ip addr add 10.231.0.2/16 dev veth-ssh-vms
ip netns exec vms ip addr add 10.231.0.3/31 dev vpeer-ssh-vms
ip netns exec ssh ip link set dev veth-ssh-vms up
ip netns exec vms ip link set dev vpeer-ssh-vms up

ip netns exec ssh service ssh start

# Forward traffic from interface eth0 port 22 to the ssh service in the ssh ns
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 22 -j DNAT --to-destination 10.10.0.1:22
iptables -t nat -A POSTROUTING -o veth-ssh -j MASQUERADE

# Disable outgoing connections to the parent ns from the ssh ns, but enable incoming
ip netns exec ssh iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
ip netns exec ssh iptables -A OUTPUT -j DROP -d 10.10.0.0/16

sysctl -w net.ipv4.conf.veth-vms.proxy_arp=1
sysctl -w net.ipv6.conf.veth-vms.disable_ipv6=1
# iptables -A FORWARD -i veth-vms -o eth0 -j ACCEPT
# iptables -A FORWARD -i vpeer-vms -o "hocusvm-tap0" -m state --state ESTABLISHED,RELATED -j ACCEPT
# iptables -t nat -A POSTROUTING -o vpeer-vms -j MASQUERADE

# ip netns exec vms iptables -A FORWARD -i "hocusvm-tap0" -o vpeer-vms -j ACCEPT
# ip netns exec vms iptables -A FORWARD -i vpeer-vms -o "hocusvm-tap0" -m state --state ESTABLISHED,RELATED -j ACCEPT
# ip netns exec vms iptables -t nat -A POSTROUTING -o vpeer-vms -j MASQUERADE
