#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

setup_fake_vm() {
  local VM_ID="$1"
  local VMS_NS_VM_IF_IP="$2"
  local VM_NS_VMS_IF_IP="$3"
  local ENABLE_SSH="$4"

  ip netns add ns-hocusvm"$VM_ID"
  ip link add hocusvm-tap"$VM_ID" type veth peer name vpeer-hocusvm"$VM_ID"
  ip link set hocusvm-tap"$VM_ID" netns vms
  ip link set vpeer-hocusvm"$VM_ID" netns ns-hocusvm"$VM_ID"
  ip netns exec vms ip addr add "$VMS_NS_VM_IF_IP"/30 dev hocusvm-tap"$VM_ID"
  ip netns exec ns-hocusvm"$VM_ID" ip addr add "$VM_NS_VMS_IF_IP"/16 dev vpeer-hocusvm"$VM_ID"
  ip netns exec vms ip link set hocusvm-tap"$VM_ID" up
  ip netns exec ns-hocusvm"$VM_ID" ip link set vpeer-hocusvm"$VM_ID" up
  ip netns exec ns-hocusvm"$VM_ID" ip route add default via "$VM_NS_VMS_IF_IP"

  ip netns exec vms sysctl -w net.ipv4.conf.hocusvm-tap"$VM_ID".proxy_arp=1
  ip netns exec vms sysctl -w net.ipv6.conf.hocusvm-tap"$VM_ID".disable_ipv6=1

  if [ ! "$ENABLE_SSH" = "true" ]; then
    return
  fi

  ip netns exec vms iptables -A FORWARD -i vpeer-ssh-vms -o hocusvm-tap"$VM_ID" -p tcp --dport 22 -j ACCEPT
  ip netns exec vms iptables -A FORWARD -i hocusvm-tap"$VM_ID" -o vpeer-ssh-vms -m state --state ESTABLISHED,RELATED -j ACCEPT
  ip netns exec vms iptables -t nat -A POSTROUTING -o vpeer-ssh-vms -j MASQUERADE
}

VMS_NS_VM0_IF_IP="10.231.0.9"
VM0_NS_VMS_IF_IP="10.231.0.10"

VMS_NS_VM1_IF_IP="10.231.0.13"
VM1_NS_VMS_IF_IP="10.231.0.14"

setup_fake_vm 0 "$VMS_NS_VM0_IF_IP" "$VM0_NS_VMS_IF_IP" true
setup_fake_vm 1 "$VMS_NS_VM1_IF_IP" "$VM1_NS_VMS_IF_IP" false

ip netns exec ns-hocusvm0 python3 -m http.server 22 -b "$VM0_NS_VMS_IF_IP" > /dev/null 2>&1 &
ip netns exec ns-hocusvm1 python3 -m http.server 22 -b "$VM1_NS_VMS_IF_IP" > /dev/null 2>&1 &
