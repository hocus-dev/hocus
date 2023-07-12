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

"$REPO_DIR"/ops/bin/setup-tcmu.sh
