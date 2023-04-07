#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"
export DOCKERFILE_DIR="${REPO_DIR}/resources/docker"

ops/bin/buildfs.sh "$DOCKERFILE_DIR/buildkite-agent.Dockerfile" "buildkite.ext4" "$REPO_DIR/resources" 5000
qemu-img convert -f raw -O qcow2 buildkite.ext4 buildkite.qcow2
qemu-img resize buildkite.qcow2 500G

total_memory=$(free -b | awk '/^Mem:/{print $2}')
allocated_memory=$(echo "scale=0; $total_memory * 0.8" | bc)
qemu-system-x86_64 \
        -m ${allocated_memory}B \
        -cpu host \
        -nographic \
        -enable-kvm \
        -kernel ../hocus-resources/resources/vmlinux-5.10-x86_64.bin \
        -drive file=../hocus-resources/resources/buildkite.qcow2,format=qcow2,if=virtio,media=disk \
        -append "root=/dev/vda console=ttyS0 ip=dhcp" \
        -netdev user,id=n1 \
        -device virtio-net-pci,netdev=n1 \
        -device virtio-balloon,deflate-on-oom=on,free-page-reporting=on
