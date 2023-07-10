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

KERNEL=./vmlinux-6.2-x86_64.bin
wget --continue --retry-connrefused --waitretry=1 --timeout=20 --tries=3 -O "$KERNEL" "https://github.com/hocus-dev/linux-kernel/releases/download/0.0.5/$KERNEL"

total_cores=$(nproc)
allocated_cores=$((total_cores / 2))
total_memory=$(free -b | awk '/^Mem:/{print $2}')
allocated_memory=16777216 # 16GB #$((total_memory * 9 / 10 / 1024))
#allocated_memory=4777216 # 16GB #$((total_memory * 9 / 10 / 1024))
qemu-system-x86_64 \
	-machine q35,acpi=off \
	-m ${allocated_memory}K \
	-blockdev node-name=q1,driver=raw,file.driver=file,file.filename=buildkite.ext4,discard=unmap,detect-zeroes=unmap,file.aio=io_uring \
	-device virtio-blk,drive=q1,discard=on \
        --kernel "$KERNEL" \
        --append "reboot=t loglevel=3 vm.compaction_proactiveness=100 vm.compact_unevictable_allowed=1 transparent_hugepage=never page_reporting.page_reporting_order=0 root=/dev/vda rw rootflags=discard ip=dhcp console=ttyS0 kernel.panic=-1 damon_reclaim.enabled=Y damon_reclaim.min_age=10000000 damon_reclaim.wmarks_low=0 damon_reclaim.wmarks_high=1000 damon_reclaim.wmarks_mid=999 damon_reclaim.quota_sz=1073741824 damon_reclaim.quota_reset_interval_ms=1000" \
        -cpu host \
	-smp ${allocated_cores} \
        -nographic \
        -enable-kvm \
	-no-reboot \
        -netdev user,id=n1 \
        -device virtio-net-pci,netdev=n1 \
        -device virtio-balloon,deflate-on-oom=on,free-page-reporting=on
