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

ip netns add ns-hocusvm0
ip link add hocusvm-tap0 type veth peer name vpeer-hocusvm0
ip link set hocusvm-tap0 netns vms
ip link set vpeer-hocusvm0 netns ns-hocusvm0
ip netns exec vms ip addr add "$VMS_NS_VM0_IF_IP"/30 dev hocusvm-tap0
ip netns exec ns-hocusvm0 ip addr add "$VM0_NS_VMS_IF_IP"/16 dev vpeer-hocusvm0
ip netns exec vms ip link set hocusvm-tap0 up
ip netns exec ns-hocusvm0 ip link set vpeer-hocusvm0 up
ip netns exec ns-hocusvm0 ip route add default via "$VM0_NS_VMS_IF_IP"

ip netns exec vms sysctl -w net.ipv4.conf.hocusvm-tap0.proxy_arp=1
ip netns exec vms sysctl -w net.ipv6.conf.hocusvm-tap0.disable_ipv6=1
ip netns exec vms iptables -A FORWARD -i "hocusvm-tap+" -o vpeer-vms -j ACCEPT
ip netns exec vms iptables -A FORWARD -i vpeer-vms -o "hocusvm-tap+" -m state --state ESTABLISHED,RELATED -j ACCEPT
ip netns exec vms iptables -t nat -A POSTROUTING -o vpeer-vms -j MASQUERADE
ip netns exec vms iptables -A FORWARD -j REJECT

sysctl -w net.ipv4.conf.veth-vms.proxy_arp=1
sysctl -w net.ipv6.conf.veth-vms.disable_ipv6=1
iptables -A FORWARD -i veth-vms -o eth0 -j ACCEPT
iptables -A FORWARD -i eth0 -o veth-vms -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -A FORWARD -j REJECT

ip netns exec vms iptables -A INPUT -j REJECT
iptables -A INPUT -i veth-ssh -j REJECT
iptables -A INPUT -i veth-vms -j REJECT
