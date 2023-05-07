---
authors: Grzegorz Uriasz (gorbak25@gmail.com)
state: draft
---

# RFD 1 - Block Registry

## What

This document defines the block registry, which is responsible for managing storage for workspaces while being extensible for future P2P operations. The goal is to decouple the workspace storage layer from the workspace runtime and use a well-defined interface between them.

## Why

Workspaces are currently defined as Docker images, so the storage layer should provide container-like primitives while being compatible with VMs. Experimenting with various storage solutions requires a fully decoupled storage layer.

## Details

### Requirements

1. Minimal assumptions about the host OS (rules out ZFS and custom kernel modules)
2. Layered storage - Supports layers that can be overlaid on top of each other (rules out raw files)
3. Combining dozens of layers without performance degradation (rules out qcow2 due to performance issues with too many backing files)
4. Allows keeping data in sparse files without needing to reformat or dedicate a disk (rules out SPDK blobfs/mayastor/ceph/etc...)
5. Resulting storage must natively support Docker on top of it after passing it to a VM (rules out overlayfs over virtio-fs)
6. Should support providing storage for both a VM and a Container

### OverlayBD Storage

OverlayBD is an OCI-compatible container format from Alibaba that meets our requirements. This RFD discusses using OverlayBD for container storage. The idea was validated in [this PoC](https://github.com/hocus-dev/hocus/pull/59). Hocus will manage VM storage using OverlayBD, managed by the block registry. The interface between the block registry and the workspace runtime are block devices - the registry is responsible for managing those block devices and the storage.

### TCMU

OverlayBD uses TCMU under the hood, which is a suitable choice for Hocus. In the future, we may easily build a custom storage format using TCMU, and the rest of our code will be compatible. All block devices created by the block registry using TCMU MUST have a SCSI Serial starting with `hocusbd-`, e.g., `hocusbd-u2fpCGJ7`. The WWN of the TCM loop device for the block registry MUST be `naa.726163636f6f6e73`. All TCMU storage objects will be exposed under a single SAS HBA (`user_726163636`) and will be forwarded to a single TCM loop target under different LUNs. OverlayBD will be forked to allow changing the name of the TCMU service and UIO path in runtime, enabling multiple block registries to run on the same host simultaneously (important for CI). The path of the UIO devices will be nonstandard.

### Exposing TCMU to the Agent Container

The Hocus install script MUST install the following udev rule on the host OS:

```
# Hardlink hocus block devices using their serial number
SUBSYSTEM=="block", ACTION=="add|change", ENV{ID_SCSI_SERIAL}=="hocusbd-[0-9A-Za-z]*", RUN+="/bin/sh -c 'mkdir -p /dev/hocus && ln $env{DEVNAME} /dev/hocus/$env{ID_SCSI_SERIAL}'"
SUBSYSTEM=="block", ACTION=="remove", ENV{ID_SCSI_SERIAL}=="hocusbd-[0-9A-Za-z]*", RUN+="/bin/sh -c 'unlink /dev/hocus/$env{ID_SCSI_SERIAL}'"
# Now hardlink UIO devices
SUBSYSTEM=="uio", ACTION=="add|change", ATTR{name}=="tcm-user/726163636/*", RUN+="/bin/sh -c 'mkdir -p /dev/hocus && ln $env{DEVNAME} /dev/hocus/%k'"
SUBSYSTEM=="uio", ACTION=="remove", ATTR{name}=="tcm-user/726163636/*", RUN+="/bin/sh -c 'unlink /dev/hocus/%k'"
```

This exposes block devices from the block registry in `/dev/hocus` on the host, along with any TCMU UIO devices. The `/dev/hocus` folder is bind-mounted into the Agent container. The block registry MUST consider that multiple agents might be running on the same computer, and it DOES NOT have exclusivity over `/dev/hocus`. `/sys/kernel/config/target` will also be bind-mounted in the container. Users of `/dev/hocus` MUST consider that there might be some latency between the creation of a block device and it appearing in `/dev/hocus`, as udev running in userspace on the host must process new events coming from the kernel.

### Block Registry Interface

The block registry stores Images and Containers. Like other projects in this space, the former represents an RO filesystem and the latter an RW one. Building blocks of Hocus MUST be idempotent for unsuccessful operations to be safely retried. Names of images and containers come from the user of the interface. The storage directory of the registry MUST be considered private. The registry might be accessed concurrently, but no code besides the registry is allowed to touch it, as it might cause the registry to end up in an inconsistent state, especially deleting an RW layer directly from the disk won't result in proper cleanup as the block registry must reconfigure TCMU and other parts of the storage system.

```js
interface Image {
  id: string
}

interface Container {
  id: string
}

interface BlockRegistry {
  getImages(): Image[]
  getContainers(): Container[]
  deleteContainer(container: Container): void
  deleteImage(image: Image): void

  // Loads an image from buildfs transferred via virtio-fs or downloaded from the internet using skopeo
  // This will destroy data, as layers will be moved not copied
  loadImageFromDisk(path: path_to_oci_dump, outputId?: string): Image
  // Creates a RW layer on top of an image, creates a random id if `outputId` is not supplied
  createContainer(image: Image, outputId?: string): Container
  // Converts the RW layer back into a RO layer, this deletes the container as overlaybd does not support cow snapshots
  commitContainer(container: Container, outputId?: string): Image

  // Creates/Destroys a block device exposing the Image/Container. Images will be exposed as RO block devices, Containers as RW block devices.
  expose(what: Image | Container): BlockDev
  hide(what: Image | Container): void

  /* FUTURE: P2P, perhaps expose a Docker registry api? */
}
```

### Transferring Images between Buildfs and the Block Registry

Use virtio-fs:

1. Attach an empty agent directory to the buildfs VM using virtio-fs (preferably on the same filesystem as the block registry)
2. Buildfs exports the image to the shared directory
3. Agent loads the image into the block registry using loadImageFromDisk

### OverlayBD Block Registry Storage

```bash
<BLOCK_REGISTRY_DIR>/tcmu_name # Name of the TCMU service owning this registry
<BLOCK_REGISTRY_DIR>/block_config/<image or container hash>.config.v1.json # OverlayBD configs for block devices
<BLOCK_REGISTRY_DIR>/layers/<content hash> # RO image layers
<BLOCK_REGISTRY_DIR>/containers/<container_id>/* # OverlayBD write layers
<BLOCK_REGISTRY_DIR>/images/<image_id>.json # Arrays of paths to layers, IF relative path then path is relative with regards to the manifest file
```
