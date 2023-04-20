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
./convertor --plain --repository 127.0.0.1:5000/buildfs --input-tag ${IMAGE_TAG} --overlaybd ${IMAGE_TAG}-obd
# Now we may extract the data from the registry...
skopeo copy --src-tls-verify=false docker://localhost:5000/buildfs:${IMAGE_TAG}-obd dir:${REPO_DIR}/poc-dir-export

# Create a 0.5TB writeble layer for overlaybd
rm -rf ${REPO_DIR}/buildkite-obd-write-layer
mkdir ${REPO_DIR}/buildkite-obd-write-layer
/opt/overlaybd/bin/overlaybd-create -s ${REPO_DIR}/buildkite-obd-write-layer/data ${REPO_DIR}/buildkite-obd-write-layer/index 512

# Now write a config for overlaybd
cat ${REPO_DIR}/poc-dir-export/manifest.json \
  | jq '.layers[].digest' \
  | sed "s@sha256:@${REPO_DIR}/poc-dir-export/@g" \
  | jq -s ". | {lowers: map({file: .}), upper: {index: \"${REPO_DIR}/buildkite-obd-write-layer/index\", data: \"${REPO_DIR}/buildkite-obd-write-layer/data\"}, resultFile: \"/tmp/poc-result\"}" \
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
# Now configure the new storage object
echo -n dev_config=overlaybd/${REPO_DIR}/overlaybd-buildkite.config.v1.json > ${TCMU_CONFIG_FS}/user_${TCMU_HBA_NUM}/${TCMU_STORAGE_OBJECT_NAME}/control
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

# Resize the FS to 512 GB - the default is 64 GB :P
e2fsck -fy /dev/${BLOCK_DEV_NAME} || true
resize2fs /dev/${BLOCK_DEV_NAME}

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
allocated_memory=$((total_memory * 8 / 10 / 1024))
qemu-system-x86_64 \
	-machine q35 \
	-m ${allocated_memory}K \
	-blockdev node-name=q1,driver=raw,file.driver=host_device,file.filename=/dev/${BLOCK_DEV_NAME},discard=unmap,detect-zeroes=unmap \
	-device virtio-blk,drive=q1,discard=on \
        -append "root=/dev/vda rw rootflags=discard console=ttyS0 ip=dhcp kernel.panic=-1" \
        -cpu host \
	-smp ${allocated_cores} \
        -nographic \
        -enable-kvm \
	-no-reboot \
        -kernel ./vmlinux-6.2-x86_64.bin \
        -netdev user,id=n1 \
        -device virtio-net-pci,netdev=n1 \
        -device virtio-balloon,deflate-on-oom=on,free-page-reporting=on
