#!/bin/bash
set -o errexit
set -o pipefail

export OUTPUT_DIR="$1"
if [ -z "$OUTPUT_DIR" ]; then
    echo "Usage: $0 OUTPUT_DIR"
    exit 1
fi

set -o nounset

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

mkdir -pv "$OUTPUT_DIR"
wget -O "$OUTPUT_DIR/vmlinux-5.10-x86_64.bin" https://github.com/hocus-dev/linux-kernel/releases/download/0.0.3/vmlinux
