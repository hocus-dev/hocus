---
authors: Grzegorz Uriasz (gorbak25@gmail.com)
state: draft
---

# RFD 1 - Block registry

## What

Defines the way workspaces store data by introducing a per agent block registry responsible for keeping track of the node storage while at the same time being extensible for future P2P operations.

## Why

To experiment with various storage solutions the workspace storage layer needs to be fully decoupled from the workspace runtime and a well defined interface between them has to be used. Workspaces are currently defined as docker images so the storage layer should provide container like primitives while at the same time being compatible with VMs.

## Details

### Requirements

1. Minimal assumptions about the host OS (rules out ZFS and custom kernel modules)
1. Layered storage - Supports layers which can be overlayed on top of each other (rules out raw files)
1. Dozens of layers can be combined together without performance degradation (rules out qcow2 due to performance issues with too many backing files)
1. Allows to keep its data in sparse files, no need to reformat or dedicate a disk for it (rules out SPDK blobfs/mayastor/ceph/etc...)
1. The resulting storage needs to natively support Docker on top of it after passing it to an VM (rules out overlayfs over virtio-fs)
1. It should both support providing storage for a VM and a Container

### OverlayBD storage

OverlayBD is an OCI compatible container format from Alibaba which is compatible with our requirements. This RFD will talk about using OverlayBD for container storage. The idea was validated in [this PoC](https://github.com/hocus-dev/hocus/pull/59). Hocus will store vm storage using overlaybd which will be managed by the block registry. The interface between the block registry and the workspace runtime are block devices - the registry is responsible for managing those block devices and the storage.

### TCMU

Overlaybd uses TCMU under the hood. We think this it's a good choice for Hocus. In the future we may easily build a custom storage format using TCMU and the rest of our code will be compatible. All block devices created by the block registry using TCMU MUST have an SCSI Serial starting with `hocusbd-`. For example `hocusbd-u2fpCGJ7`. The WWN of the TCM loop device for the block registry MUST be `naa.726163636f6f6e73`. All TCMU storage objects will be exposed under a single SAS HBA and will be forwarded to a single TCM loop target under different LUN's. OverlayBD will be forked so it will be possible to change the name of the TCMU service and UIO path in runtime so multiple block registries can run on the same host at the same time (important for CI).

### Exposing TCMU to the agent container

The Hocus install script NEEDS to install the following udev rule on the host OS:

```
# Hardlink hocus block devices using their serial number
SUBSYSTEM=="block", ACTION=="add|change", ENV{ID_SCSI_SERIAL}=="hocusbd-[0-9A-Za-z]*", RUN+="/bin/sh -c 'mkdir -p /dev/hocus && ln $env{DEVNAME} /dev/hocus/$env{ID_SCSI_SERIAL}'"
SUBSYSTEM=="block", ACTION=="remove", ENV{ID_SCSI_SERIAL}=="hocusbd-[0-9A-Za-z]*", RUN+="/bin/sh -c 'unlink /dev/hocus/$env{ID_SCSI_SERIAL}'"
```

This exposes block devices from the block registry in `/dev/hocus` on the host, the `/dev/hocus` folder is bind mounted into the Agent container. The block registry MUST consider that multiple agents might be running on the same computer and it does not have exclusivity over `/dev/hocus`. `/sys/kernel/config` and `/dev/uio0` will also be bind mounted in the container.

### Block registry interface

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
  loadImageFromDisk(path: path_to_oci_dump, outputId?: string): Image
  // Creates a RW layer on top of an image, creates a random hash
  createContainer(image: Image, outputId?: string): Container
  // Converts the RW layer back into a RO layer, this deletes the container as overlaybd does not support cow snapshots
  commitContainer(container: Container, outputId?: string): Image

  // Creates/Destroys a block device exposing the Image/Container. Images will be exposed as RO block devices, Containers as RW block devices.
  expose(what: Image | Container): BlockDev
  hide(what: Image | Container): void

  /* FUTURE: P2P, perhaps expose a Docker registry api? */
}
```

### Transferring images between buildfs and the block registry

Use virtio-fs:

1. Attach an empty agent directory to the buildfs vm using virtio-fs
2. buildfs exports the image to the shared directory
3. Agent loads the image into the block registry using loadImageFromDisk

### Overlaybd block registry storage

```bash
<BLOCK_REGISTRY_DIR>/tcmu_name # Name of the TCMU service owning this registry
<BLOCK_REGISTRY_DIR>/block_config/<image or container hash>.config.v1.json # OverlayBD configs for block devices
<BLOCK_REGISTRY_DIR>/layers/<content hash> # RO image layers
<BLOCK_REGISTRY_DIR>/containers/<container hash>/* # OverlayBD write layers
<BLOCK_REGISTRY_DIR>/images/<image hash>.json # Arrays of layer content hashes
```
