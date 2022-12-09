#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

HOST_NS_VMS_IF_IP="10.231.0.1"
VMS_NS_HOST_IF_IP="10.231.0.2"

HOST_NS_SSH_IF_IP="10.10.0.1"
SSH_NS_HOST_IF_IP="10.10.0.2"

SSH_NS_VMS_IF_IP="10.231.0.5"
VMS_NS_SSH_IF_IP="10.231.0.6"

VMS_NS_VM0_IF_IP="10.231.0.9"
VM0_NS_VMS_IF_IP="10.231.0.10"

SSH_NS_TST_IF_IP="10.11.0.1"
TST_NS_SSH_IF_IP="10.11.0.2"

# Setup the vms network namespace
ip netns add vms
ip link add veth-vms type veth peer name vpeer-vms
ip link set vpeer-vms netns vms
ip netns exec vms ip addr add "$VMS_NS_HOST_IF_IP"/30 dev vpeer-vms
ip addr add "$HOST_NS_VMS_IF_IP"/16 dev veth-vms
ip link set veth-vms up
ip netns exec vms ip link set dev vpeer-vms up
ip netns exec vms ip route add default via "$VMS_NS_HOST_IF_IP"

# Setup the ssh network namespace
ip netns add ssh
ip link add veth-ssh type veth peer name vpeer-ssh
ip link set vpeer-ssh netns ssh
ip netns exec ssh ip addr add "$SSH_NS_HOST_IF_IP"/16 dev vpeer-ssh
ip addr add "$HOST_NS_SSH_IF_IP"/30 dev veth-ssh
ip link set veth-ssh up
ip netns exec ssh ip link set dev vpeer-ssh up

# Setup the tst network namespace. Used for testing connectivity to the ssh service
# in agent tests.
ip netns add tst
ip link add veth-ssh-tst type veth peer name vpeer-ssh-tst
ip link set veth-ssh-tst netns ssh
ip link set vpeer-ssh-tst netns tst
ip netns exec ssh ip addr add "$SSH_NS_TST_IF_IP"/16 dev veth-ssh-tst
ip netns exec tst ip addr add "$TST_NS_SSH_IF_IP"/16 dev vpeer-ssh-tst
ip netns exec ssh ip link set dev veth-ssh-tst up
ip netns exec tst ip link set dev vpeer-ssh-tst up
ip netns exec tst ip link set dev lo up
ip netns exec tst ip route add default via "$TST_NS_SSH_IF_IP"

# Connect the vms network namespace to the ssh network namespace
ip link add veth-ssh-vms type veth peer name vpeer-ssh-vms
ip link set veth-ssh-vms netns ssh
ip link set vpeer-ssh-vms netns vms
ip netns exec ssh ip addr add "$SSH_NS_VMS_IF_IP"/16 dev veth-ssh-vms
ip netns exec vms ip addr add "$VMS_NS_SSH_IF_IP"/30 dev vpeer-ssh-vms
ip netns exec ssh ip link set dev veth-ssh-vms up
ip netns exec vms ip link set dev vpeer-ssh-vms up

ip netns exec ssh service ssh start

# Forward traffic from interface eth0 port 22 to the ssh service in the ssh ns
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 22 -j DNAT --to-destination "$SSH_NS_HOST_IF_IP":22
iptables -t nat -A POSTROUTING -o veth-ssh -j MASQUERADE

# Disable outgoing connections to the parent ns from the ssh ns, but enable incoming
ip netns exec ssh iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
ip netns exec ssh iptables -A OUTPUT -j REJECT -d "$HOST_NS_SSH_IF_IP"/16

# Enable making connections from the ssh ns
ip netns exec ssh ip link set dev lo up

# Enable communication between the host ns and the vms
ip netns exec vms sysctl -w net.ipv4.conf.vpeer-vms.proxy_arp=1
ip netns exec vms sysctl -w net.ipv6.conf.vpeer-vms.disable_ipv6=1
ip netns exec vms iptables -A FORWARD -i "vm+" -o vpeer-vms -j ACCEPT
ip netns exec vms iptables -A FORWARD -i vpeer-vms -o "vm+" -j ACCEPT
ip netns exec vms iptables -t nat -A POSTROUTING -o vpeer-vms -j MASQUERADE
ip netns exec vms iptables -t nat -A POSTROUTING -o "vm+" -j MASQUERADE
ip netns exec vms iptables -P FORWARD DROP
ip netns exec vms iptables -P INPUT DROP

ip netns exec vms sysctl -w net.ipv4.conf.vpeer-ssh-vms.proxy_arp=1
ip netns exec vms sysctl -w net.ipv6.conf.vpeer-ssh-vms.disable_ipv6=1

sysctl -w net.ipv4.conf.veth-vms.proxy_arp=1
sysctl -w net.ipv6.conf.veth-vms.disable_ipv6=1
iptables -A FORWARD -i veth-vms -o eth0 -j ACCEPT
iptables -A FORWARD -i eth0 -o veth-vms -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

iptables -A FORWARD -i eth0 -o veth-ssh -j ACCEPT
iptables -A FORWARD -i veth-ssh -o eth0 -m state --state ESTABLISHED,RELATED -j ACCEPT

# Part of enabling communication between outside world and the vms
# The rest is added dynamically by the agent when a vm is made public
iptables -A POSTROUTING -t nat -o vpeer-ssh-vms -j MASQUERADE

iptables -P FORWARD DROP
iptables -P INPUT DROP
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -i eth0 -j ACCEPT
iptables -A INPUT -i veth-vms -m state --state ESTABLISHED,RELATED -j ACCEPT
