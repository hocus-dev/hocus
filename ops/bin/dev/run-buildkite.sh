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
export DOCKERFILE_DIR="${REPO_DIR}/resources/docker"

rm -f buildkite.ext4
ops/bin/buildfs.sh "$DOCKERFILE_DIR/buildkite-agent.Dockerfile" "buildkite.ext4" "$REPO_DIR/resources" 524288

wget --continue --retry-connrefused --waitretry=1 --timeout=20 --tries=3 -O "./vmlinux-5.10-x86_64.bin" https://github.com/hocus-dev/linux-kernel/releases/download/0.0.3/vmlinux

total_cores=$(nproc)
allocated_cores=$((total_cores / 2))
total_memory=$(free -b | awk '/^Mem:/{print $2}')
allocated_memory=$((total_memory * 8 / 10 / 1024))
qemu-system-x86_64 \
	-m ${allocated_memory}K,slots=2,maxmem=1000G \
        -cpu host \
	-smp ${allocated_cores} \
        -nographic \
        -enable-kvm \
	-no-reboot \
        -kernel ./vmlinux-6.2-x86_64.bin \
	-object memory-backend-file,id=mem1,share=on,mem-path=./buildkite.ext4,size=512G,align=2M \
	-device virtio-pmem-pci,memdev=mem1,id=nv1 \
        -append "root=/dev/pmem0 rootflags=dax console=ttyS0 ip=dhcp kernel.panic=-1" \
        -netdev user,id=n1 \
        -device virtio-net-pci,netdev=n1 \
        -device virtio-balloon,deflate-on-oom=on,free-page-reporting=on

