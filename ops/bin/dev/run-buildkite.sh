#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"
export DOCKERFILE_DIR="${REPO_DIR}/resources/docker"

ops/bin/buildfs.sh "$DOCKERFILE_DIR/buildkite-agent.Dockerfile" "buildkite.ext4" "$REPO_DIR/resources" 5000
dd if=/dev/zero of=buildkite.ext4 bs=1M count=0 seek=500000
e2fsck -y -f buildkite.ext4 || true
resize2fs buildkite.ext4
qemu-img convert -f raw -O qcow2 buildkite.ext4 buildkite.qcow2

wget --continue --retry-connrefused --waitretry=1 --timeout=20 --tries=3 -O "./vmlinux-5.10-x86_64.bin" https://github.com/hocus-dev/linux-kernel/releases/download/0.0.3/vmlinux

total_cores=$(nproc)
allocated_cores=$((total_cores / 2))
total_memory=$(free -b | awk '/^Mem:/{print $2}')
allocated_memory=$((total_memory * 8 / 10 / 1024))
qemu-system-x86_64 \
        -m ${allocated_memory}K \
        -cpu host \
	-smp ${allocated_cores} \
        -nographic \
        -enable-kvm \
	-no-reboot \
        -kernel ./vmlinux-5.10-x86_64.bin \
        -drive file=./buildkite.qcow2,format=qcow2,if=virtio,media=disk \
        -append "root=/dev/vda console=ttyS0 ip=dhcp kernel.panic=-1" \
        -netdev user,id=n1 \
        -device virtio-net-pci,netdev=n1 \
        -device virtio-balloon,deflate-on-oom=on,free-page-reporting=on

