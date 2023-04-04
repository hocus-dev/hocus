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
export RESOURCES_DIR=$REPO_DIR/../hocus-resources/resources

# Set up the image for running tests
cp $RESOURCES_DIR/buildfs.ext4 $RESOURCES_DIR/tmp-buildfs.ext4
dd if=/dev/zero of=$RESOURCES_DIR/tmp-buildfs.ext4 bs=1M count=0 seek=50000
e2fsck -y -f $RESOURCES_DIR/tmp-buildfs.ext4 || true
resize2fs $RESOURCES_DIR/tmp-buildfs.ext4

expect -c "
# 16 seconds max for boot
set timeout 16
# Spawn a VM with the new disk
spawn qemu-system-x86_64 \
    -m 1024 \
    -nographic \
    -enable-kvm \
    -kernel $RESOURCES_DIR/vmlinux-5.10-x86_64.bin \
    -drive file=$RESOURCES_DIR/tmp-buildfs.ext4,format=raw,if=virtio,media=disk \
    -append \"root=/dev/vda console=ttyS0 ip=dhcp\" \
    -netdev user,id=n1 \
    -device virtio-net-pci,netdev=n1

# Login to the VM
expect \"login:\"
send \"root\r\"
expect \"Password:\"
send \"root\r\"
expect \"root@\"

# 120 seconds max for download
set timeout 120
send \"docker pull hocusdev/workspace\r\"
expect \"Downloaded newer image for hocusdev/workspace:latest\"
expect \"root@\"

# 12 seconds max for fsync
set timeout 12
# Shut down the VM
send \"sync\r\"
expect \"root@\"
exit 0
"
# Shrink the FS as much as possible
e2fsck -y -f $RESOURCES_DIR/tmp-buildfs.ext4 || true
resize2fs -M $RESOURCES_DIR/tmp-buildfs.ext4
mv $RESOURCES_DIR/tmp-buildfs.ext4 $RESOURCES_DIR/test-buildfs.ext4
