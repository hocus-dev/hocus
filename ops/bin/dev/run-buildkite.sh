#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

if ! ($( systemctl is-active --quiet overlaybd-tcmu.service )) ; then
   echo "Overlaybd was not installed"
   exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"
export DOCKERFILE_DIR="${REPO_DIR}/resources/docker"

DOCKERFILE_PATH="$DOCKERFILE_DIR/buildkite-agent.Dockerfile"
CONTEXT_DIR="$REPO_DIR/resources"

wget --continue --retry-connrefused --waitretry=1 --timeout=20 --tries=3 -O "./vmlinux-6.2-x86_64.bin" https://github.com/hocus-dev/linux-kernel/releases/download/0.0.5/vmlinux-6.2-x86_64.bin

IMAGE_TAG=$(basename "$DOCKERFILE_PATH" | sed 's/\.Dockerfile//')
IMAGE_NAME="buildfs:${IMAGE_TAG}"

# First build the VM rootfs using docker
docker build --progress=plain --tag "${IMAGE_NAME}" --file "${DOCKERFILE_PATH}" "${CONTEXT_DIR}"
# Now spawn a temporary docker registry on localhost:5000 - it's a PoC for now :P
ID=$(docker run -d --rm \
  -p 5000:5000 \
  --name hocus-poc-registry \
  -v $REPO_DIR/hocus-poc-registry:/var/lib/registry \
  registry:2)

clean_up() {
 docker kill $ID
}
trap clean_up INT TERM EXIT

# Move the built docker image to the temporary docker registry
skopeo copy --dest-tls-verify=false docker-daemon:"${IMAGE_NAME}" docker://localhost:5000/${IMAGE_NAME}
# Now we may convert the image to overlaybd layers .-.
#resources/bin/convertor --plain --repository 127.0.0.1:5000/buildfs --input-tag ${IMAGE_TAG} --fastoci ${IMAGE_TAG}-foci
resources/bin/convertor --plain --repository 127.0.0.1:5000/buildfs --input-tag ${IMAGE_TAG} --overlaybd ${IMAGE_TAG}-obd
# Now we may extract the data from the registry...
skopeo copy --src-tls-verify=false docker://localhost:5000/buildfs:${IMAGE_TAG}-obd dir:${REPO_DIR}/poc-dir-export
#skopeo copy --src-tls-verify=false docker://localhost:5000/buildfs:${IMAGE_TAG}-foci dir:${REPO_DIR}/poc-dir-export-meta
#skopeo copy --src-tls-verify=false docker://localhost:5000/buildfs:${IMAGE_TAG} dir:${REPO_DIR}/poc-dir-export-main

# Create a 0.5TB writeble layer for overlaybd
rm -rf ${REPO_DIR}/buildkite-obd-write-layer
mkdir ${REPO_DIR}/buildkite-obd-write-layer
/opt/overlaybd/bin/overlaybd-create -s ${REPO_DIR}/buildkite-obd-write-layer/data ${REPO_DIR}/buildkite-obd-write-layer/index 512

# Now write a config for overlaybd
#node create_config.mjs | jq '.' > ${REPO_DIR}/overlaybd-buildkite.config.v1.json
cat ${REPO_DIR}/poc-dir-export/manifest.json \
  | jq '.layers[].digest' \
  | sed "s@sha256:@${REPO_DIR}/poc-dir-export/@g" \
  | jq -s ". | {lowers: map({file: .}), upper: {index: \"${REPO_DIR}/buildkite-obd-write-layer/index\", data: \"${REPO_DIR}/buildkite-obd-write-layer/data\"}, resultFile: \"/tmp/poc-result\", hocusManifest: \"AAAAAAA\"}" \
  > ${REPO_DIR}/overlaybd-buildkite.config.v1.json

TCMU_CONFIG_FS="/sys/kernel/config/target/core"
TCMU_HBA_NUM=1
TCMU_STORAGE_OBJECT_NAME="buildkite-vm"
TCM_LOOP_WWN="naa.123456789abcdef"
TCM_LOOP_LUN=173
TCM_LOOP_PORT=5

# Cleanup from previous runs
# First clean TCM loop devices .-.
rm -f /sys/kernel/config/target/loopback/${TCM_LOOP_WWN}/tpgt_${TCM_LOOP_PORT}/lun/lun_${TCM_LOOP_LUN}/${TCMU_STORAGE_OBJECT_NAME}
rmdir /sys/kernel/config/target/loopback/${TCM_LOOP_WWN}/tpgt_${TCM_LOOP_PORT}/lun/lun_${TCM_LOOP_LUN} || true
rmdir /sys/kernel/config/target/loopback/${TCM_LOOP_WWN}/tpgt_${TCM_LOOP_PORT} || true
rmdir /sys/kernel/config/target/loopback/${TCM_LOOP_WWN} || true
# Next clean TCMU
rmdir ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM}/${TCMU_STORAGE_OBJECT_NAME} || true
rmdir ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM} || true
rm -f /tmp/poc-result

# Create an TCMU HBA
mkdir ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM}
# Now create an storage object on that HBA
mkdir ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM}/${TCMU_STORAGE_OBJECT_NAME}
# Change the vendor
BD_SERIAL=hocusbd-$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 8 || true)
echo -n "$BD_SERIAL" > ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM}/${TCMU_STORAGE_OBJECT_NAME}/wwn/vpd_unit_serial
# Now configure the new storage object
echo -n dev_config=hellofromhocusa/${REPO_DIR}/overlaybd-buildkite.config.v1.json > ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM}/${TCMU_STORAGE_OBJECT_NAME}/control
# And enable it
echo -n 1 > ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM}/${TCMU_STORAGE_OBJECT_NAME}/enable

# Check status of that storage object - will be written by overlaybd if everything worked
echo "OverlayBD STATUS:"
cat /tmp/poc-result

# Great - now that the storage object was configured it's time to expose it via an TCM loop device
# First create a new tcm loop device, next expose a port on it and bind it to a LUN
mkdir -p /sys/kernel/config/target/loopback/${TCM_LOOP_WWN}/tpgt_${TCM_LOOP_PORT}/lun/lun_${TCM_LOOP_LUN}
# Looks like someone played Starcraft too much
echo -n "${TCM_LOOP_WWN}" > /sys/kernel/config/target/loopback/${TCM_LOOP_WWN}/tpgt_${TCM_LOOP_PORT}/nexus
# Bind the TCMU storage object to the TCM loop device
ln -s ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM}/${TCMU_STORAGE_OBJECT_NAME} /sys/kernel/config/target/loopback/${TCM_LOOP_WWN}/tpgt_${TCM_LOOP_PORT}/lun/lun_${TCM_LOOP_LUN}/${TCMU_STORAGE_OBJECT_NAME}

# Ok now we should finally have a block device
# The problem is that we need to discover it first .-.
BLOCK_DEV_SCSI_ADDR="$(cat /sys/kernel/config/target/loopback/${TCM_LOOP_WWN}/tpgt_${TCM_LOOP_PORT}/address):${TCM_LOOP_LUN}"
# WARNING - one SCSI device might expose multiple partitions - here we assume that there is only one entry!!!
BLOCK_DEV_NAME=$(ls /sys/class/scsi_device/${BLOCK_DEV_SCSI_ADDR}/device/block)
#BLOCK_DEV_NAME=hocus/${BD_SERIAL}
# Wait for udev to finish
timeout 5 bash -c "while [ ! -e /dev/${BLOCK_DEV_NAME} ]; do sleep 0.1; done"

# Resize the FS to 512 GB - the default is 64 GB :P
e2fsck -fy /dev/${BLOCK_DEV_NAME} || true
resize2fs /dev/${BLOCK_DEV_NAME}

# Network cleanup
ip link del name brbk0 type bridge || true
ip tuntap del mode tap tapbk0 || true
killall dnsmasq || true

# Setup dhcp
ip link add name brbk0 type bridge
ip addr add 192.168.100.1/24 dev brbk0
ip link set dev brbk0 up
dnsmasq --interface=brbk0 --bind-interfaces --dhcp-range=192.168.100.50,192.168.100.254

# Connect tap to bridge
ip tuntap add mode tap tapbk0
ip link set dev tapbk0 up
ip link set dev tapbk0 master brbk0

# NAT from the bridge to the outside world
sysctl net.ipv4.ip_forward=1
iptables -t nat -A POSTROUTING -j MASQUERADE
iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i brbk0 -j ACCEPT

KERNEL=./vmlinux-6.2-x86_64.bin
#KERNEL=./resources/kernels/vmlinux-6.3-x86_64.bin
#KERNEL=./resources/kernels/vmlinux-6.2-x86_64.bin
#KERNEL=./resources/kernels/vmlinux-5.10-x86_64.bin
#KERNEL=./resources/kernels/vmlinux-alibaba-cloud-kernel-5.10-x86_64.bin

# CrosVM - Use the crosvm-git package on arch
function runCrosVM {
  total_cores=$(nproc)
  allocated_cores=$((total_cores / 2))
  total_memory=$(free -b | awk '/^Mem:/{print $2}')
  allocated_memory=$((total_memory * 8 / 10 / 1024 / 1024))
  crosvm run \
    -m ${allocated_memory} \
    --balloon-page-reporting \
    -c ${allocated_cores} \
    --block path=/dev/${BLOCK_DEV_NAME},async-executor=epoll,sparse=true \
    -p "root=/dev/vda rw rootflags=discard console=ttyS0 kernel.panic=-1" \
    $KERNEL
}

# Cloud Hypervisor - latest release downloaded from git
function runCloudHypervisor {
  wget https://github.com/cloud-hypervisor/cloud-hypervisor/releases/download/v28.3/cloud-hypervisor-static -O cloud-hypervisor-static
  chmod +x cloud-hypervisor-static
  setcap cap_net_admin+ep cloud-hypervisor-static
  cp cloud-hypervisor-static /usr/bin/cloud-hypervisor-static

  rm -rf socket_dir
  mkdir socket_dir
  total_cores=$(nproc)
  allocated_cores=$((total_cores / 2))
  total_memory=$(free -b | awk '/^Mem:/{print $2}')
  allocated_memory=16777216 # 16GB #$((total_memory * 8 / 10 / 1024))
#  nsjail \
#   -t 0 \
#   --forward_signals \
#   --disable_clone_newnet \
#   -Mo \
#   --user 9999999 \
#   --group 9999999 \
#   -R /dev/net/tun \
#   -R /dev/urandom \
#   -R /usr/bin/cloud-hypervisor-static \
#   -R /dev/${BLOCK_DEV_NAME} \
#   -R /dev/kvm \
#   -R $(pwd)/vmlinux-6.2-x86_64.bin:/vmlinux \
#   -B $(pwd)/socket_dir:/socks \
#   --rlimit_nofile 1024 \
#   --rlimit_as inf \
#   -- \
#ORDER 6 in free page reporting works very well :)
   /usr/bin/cloud-hypervisor-static \
    --api-socket socket_dir/ch.sock \
    --rng src=/dev/urandom \
    --seccomp log \
    --console off \
    --serial tty \
    --net "tap=tapbk0" \
    --kernel $KERNEL \
    --cmdline "loglevel=3 vm.compaction_proactiveness=100 vm.compact_unevictable_allowed=1 transparent_hugepage=never page_reporting.page_reporting_order=0 root=/dev/vda rw rootflags=discard ip=dhcp console=ttyS0 kernel.panic=-1 damon_reclaim.enabled=Y damon_reclaim.min_age=10000000 damon_reclaim.wmarks_low=0 damon_reclaim.wmarks_high=1000 damon_reclaim.wmarks_mid=999 damon_reclaim.quota_sz=1073741824 damon_reclaim.quota_reset_interval_ms=1000" \
    --memory size=${allocated_memory}K \
    --cpus boot=${allocated_cores},max=${allocated_cores} \
    --disk path=/dev/${BLOCK_DEV_NAME} \
    --balloon free_page_reporting=on,deflate_on_oom=on
}

# QEMU
function runQemu {
	# Qemu options for virtio-blk
	#-m ${allocated_memory}K \
	#-blockdev node-name=q1,driver=raw,file.driver=host_device,file.filename=/dev/${BLOCK_DEV_NAME},discard=on,detect-zeroes=on \
	#-device virtio-blk,drive=q1 \
        #-append "root=/dev/vda rw rootflags=discard console=ttyS0 ip=dhcp kernel.panic=-1" \

	# Qemu options for virtio-pmem
	#-m ${allocated_memory}K,slots=2,maxmem=1000G \
	#-object memory-backend-file,id=mem1,share=on,mem-path=/dev/${BLOCK_DEV_NAME},size=512G,align=2M \
	#-device virtio-pmem-pci,memdev=mem1,id=nv1 \
        #-append "root=/dev/pmem0 rw rootflags=dax,discard console=ttyS0 ip=dhcp kernel.panic=-1" \

# Now finally we may boot the vm :)
total_cores=$(nproc)
allocated_cores=$((total_cores / 2))
total_memory=$(free -b | awk '/^Mem:/{print $2}')
allocated_memory=16777216 # 16GB #$((total_memory * 9 / 10 / 1024))
qemu-system-x86_64 \
	-machine q35,acpi=off \
	-m ${allocated_memory}K \
	-blockdev node-name=q1,driver=raw,file.driver=host_device,file.filename=/dev/${BLOCK_DEV_NAME},discard=unmap,detect-zeroes=unmap,file.aio=io_uring \
	-device virtio-blk,drive=q1,discard=on \
        --kernel $KERNEL \
        --append "reboot=t root=/dev/vda rw rootflags=discard ip=dhcp console=ttyS0 damon_reclaim.enabled=Y damon_reclaim.min_age=30000000 damon_reclaim.wmarks_low=0 damon_reclaim.wmarks_high=1000 damon_reclaim.wmarks_mid=1000" \
        -cpu host \
	-smp ${allocated_cores} \
        -nographic \
        -enable-kvm \
	-no-reboot \
        -netdev tap,ifname=tapbk0,script=no,downscript=no,vhost=on,id=n1 \
        -device virtio-net-pci,netdev=n1 \
        -device virtio-balloon,deflate-on-oom=on,free-page-reporting=on
}

function runQemuMicroVM {
# Now finally we may boot the vm :)
total_cores=$(nproc)
allocated_cores=$((total_cores / 2))
total_memory=$(free -b | awk '/^Mem:/{print $2}')
allocated_memory=16777216 # 16GB #$((total_memory * 9 / 10 / 1024))
qemu-system-x86_64 \
        -kernel $KERNEL \
	-bios ./resources/firmware/qboot.rom \
	-machine microvm,x-option-roms=off,rtc=off \
	-m ${allocated_memory}K \
	-blockdev node-name=q1,driver=raw,file.driver=host_device,file.filename=/dev/${BLOCK_DEV_NAME},discard=unmap,detect-zeroes=unmap,file.aio=io_uring \
	-device virtio-blk-device,drive=q1,discard=on \
        -append "reboot=t root=/dev/vda rw rootflags=discard ip=dhcp earlyprintk=ttyS0 console=ttyS0 kernel.panic=-1 damon_reclaim.enabled=Y damon_reclaim.min_age=30000000 damon_reclaim.wmarks_low=0 damon_reclaim.wmarks_high=1000 damon_reclaim.wmarks_mid=1000" \
        -cpu host \
	-smp ${allocated_cores} \
        -nodefaults -no-user-config -nographic \
	-serial stdio \
        -enable-kvm \
	-no-reboot \
        -netdev tap,ifname=tapbk0,script=no,downscript=no,vhost=on,id=n1 \
        -device virtio-net-device,netdev=n1 \
        -device virtio-balloon-device,deflate-on-oom=on,free-page-reporting=on
}

runCloudHypervisor
#runQemu

