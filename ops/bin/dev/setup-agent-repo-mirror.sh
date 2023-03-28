#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

export ONLY_REMOVE="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

export LOWER_DIR="/home/hocus/dev/project"
export UPPER_DIR="/home/hocus/dev/agent-project-upperdir"
export WORK_DIR="/home/hocus/dev/agent-project-workdir"
export MOUNT_DIR="/home/hocus/dev/agent-project"

rm -rf "$UPPER_DIR"
rm -rf "$WORK_DIR"
umount "$MOUNT_DIR" 2>/dev/null || true

if [ -n "$ONLY_REMOVE" ]; then
    exit 0
fi

su hocus -c "mkdir -p $UPPER_DIR"
su hocus -c "mkdir -p $WORK_DIR"
su hocus -c "mkdir -p $MOUNT_DIR"

mount -t overlay overlay -o "lowerdir=$LOWER_DIR,upperdir=$UPPER_DIR,workdir=$WORK_DIR" "$MOUNT_DIR"
