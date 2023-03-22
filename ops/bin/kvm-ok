#!/bin/sh
#
# kvm-ok - check whether the CPU we're running on supports KVM acceleration
# Copyright (C) 2008-2010 Canonical Ltd.
#
# Authors:
#  Dustin Kirkland <kirkland@canonical.com>
#  Kees Cook <kees.cook@canonical.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3,
# as published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
set -e

assert_root() {
	if [ "$(id -u)" != "0" ]; then
		echo "INFO: For more detailed results, you should run this as root"
		echo "HINT:   sudo $0"
		exit 1
	fi
}

verdict() {
	# Print verdict
	if [ "$1" = "0" ]; then
		echo "KVM acceleration can be used"
		exit 0
	else
		echo "KVM acceleration can NOT be used"
		exit 1
	fi
}

# check cpu flags for capability
virt=$(egrep -m1 -w '^flags[[:blank:]]*:' /proc/cpuinfo | egrep -wo '(vmx|svm)') || true
[ "$virt" = "vmx" ] && brand="intel"
[ "$virt" = "svm" ] && brand="amd"

if [ -z "$virt" ]; then
	echo "INFO: Your CPU does not support KVM extensions"
	assert_root
	verdict 1
fi

# Now, check that the device exists
if [ -e /dev/kvm ]; then
	echo "INFO: /dev/kvm exists"
	verdict 0
else
	echo "INFO: /dev/kvm does not exist"
	echo "HINT:   sudo modprobe kvm_$brand"
fi

assert_root

# Prepare MSR access
msr="/dev/cpu/0/msr"
if [ ! -r "$msr" ]; then
	modprobe msr
fi
if [ ! -r "$msr" ]; then
	echo "You must be root to run this check." >&2
	exit 2
fi

echo "INFO: Your CPU supports KVM extensions"

disabled=0
# check brand-specific registers
if [ "$virt" = "vmx" ]; then
        BIT=$(rdmsr --bitfield 0:0 0x3a 2>/dev/null || true)
        if [ "$BIT" = "1" ]; then
                # and FEATURE_CONTROL_VMXON_ENABLED_OUTSIDE_SMX clear (no tboot)
                BIT=$(rdmsr --bitfield 2:2 0x3a 2>/dev/null || true)
                if [ "$BIT" = "0" ]; then
			disabled=1
                fi
        fi

elif [ "$virt" = "svm" ]; then
        BIT=$(rdmsr --bitfield 4:4 0xc0010114 2>/dev/null || true)
        if [ "$BIT" = "1" ]; then
		disabled=1
        fi
else
	echo "FAIL: Unknown virtualization extension: $virt"
	verdict 1
fi

if [ "$disabled" -eq 1 ]; then
	echo "INFO: KVM ($virt) is disabled by your BIOS"
	echo "HINT: Enter your BIOS setup and enable Virtualization Technology (VT),"
	echo "      and then hard poweroff/poweron your system"
	verdict 1
fi

verdict 0
