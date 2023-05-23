#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"

# Check if configfs is mounted(for some reason right now hocus workspaces don't automount this)
if ! mountpoint -q /sys/kernel/config/; then
    mount -t configfs none /sys/kernel/config
fi
# Check if kernel has target_core_user compiled in
if ! [ -d /sys/kernel/config/target ] ; then
    echo "Please run a workspace with the target_core_user module compiled in"; 
    exit 1
fi
# Check if kernel has tcm_loop compiled in
if ! [ -d /sys/kernel/config/target/loopback/ ] ; then
    # Oh perhaps the module is there but not started?
    mkdir /sys/kernel/config/target/loopback/ || true
    # If the directory is not there then the kernel doesn't have tcm_loop
    if ! [ -d /sys/kernel/config/target/loopback/ ] ; then
        echo "Please run a workspace with the tcm_loop module compiled in"; 
        exit 1
    fi
fi
# Check if kernel has scsi disk support
if ! [ -d /sys/bus/scsi/drivers/sd ] ; then
    echo "No scsi disk support detected"; 
    exit 1
fi

# Just a sanity check
cat /sys/kernel/config/target/version
cat /sys/kernel/config/target/loopback/version

/bin/bash "$REPO_DIR/ops/bin/dev/build-vm-images.sh" "/home/hocus/dev/hocus-resources/resources"
/bin/bash "$REPO_DIR/ops/bin/dev/download-kernel.sh" "/home/hocus/dev/hocus-resources/resources"
