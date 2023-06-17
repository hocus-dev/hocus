---
authors: Grzegorz Uriasz (gorbak25@gmail.com)
state: implemented (since 0.3)
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

OverlayBD uses TCMU under the hood, which is a suitable choice for Hocus. In the future, we may easily build a custom storage format using TCMU, and the rest of our code will be compatible. All block devices created by the block registry using TCMU MUST have a SCSI Serial starting with `hocusbd-`, e.g., `hocusbd-39d3ea09-234b-4169-982b-8ceaa638062e`. The WWN of the TCM loop device for the block registry MUST be `naa.726163636f6f6e73`. All TCMU storage objects will be exposed under a single SAS HBA (`user_726163636`) and will be forwarded to a single TCM loop target (`tpgt_1`) under different LUNs. OverlayBD will be forked to allow changing the TCMU subtype and UIO path in runtime, enabling multiple block registries to run on the same host simultaneously (important for CI). The path of the UIO devices will be nonstandard (`/dev/hocus/uio*`). The registry MUST NOT assume it has exclusivity over the TCMU HBA or the TCM LOOP HBA/TARGET. The names of storage objects under the shared TCMU HBA MUST start with the subtype of the registry (for ex. `<subtype>_<internal_registry_name>`), this way it's possible to distinguish different Hocus instances on a single host. The LUN under which a given TCMU storage object is exposed must be derived from the storage object name using a hash function. The block registry MUST NOT place any TCMU objects under Well Known LUNs or the last LUN available on the system. The block registry MUST consider that the hash function mapping from the storage object name to the lunId might have collisions possibly with another block registry on the same machine. The block registry MUST use the mapping hash function ONLY for exposing an TCMU object to the system, all other methods must retrieve the mapping from reading the alua members (`<config_fs>/target/core/user_726163636/<tcmu_subtype>_<internal_registry_name>/alua/default_tg_pt_gp/members`).

### Exposing TCMU to the Agent Container

Hocus agent requires access to `configfs` and `devtmpfs`, both of which are bind mounted into the agent container from the host. `devtmpfs` should be present at `/dev/hocus` and `configfs` at `/sys/kernel/config`. Limiting privileges using udev is not sensible as the agent container MUST run in privileged mode in order to create and manage network namespaces for the workspaces and udev introduces additional complexity and latency to the system. The block registry MUST consider that multiple agents might be running on the same computer, and it DOES NOT have exclusivity over `/dev/hocus` or `/sys/kernel/config`.

### Block Registry Interface

The block registry stores Images and Containers. Like other projects in this space, the former represents an RO filesystem and the latter an RW one. Building blocks of Hocus MUST be idempotent for unsuccessful operations to be safely retried. Names of images and containers come from the user of the interface. The storage directory of the registry MUST be considered private. The registry might be accessed concurrently, but no code besides the registry is allowed to touch it, as it might cause the registry to end up in an inconsistent state, especially deleting an RW layer directly from the disk won't result in proper cleanup as the block registry must reconfigure TCMU and other parts of the storage system.

```js
type ImageId = `im_${string}`;
type ContainerId = `ct_${string}`;
type IdempotenceKey = string;
export const EXPOSE_METHOD = {
  BLOCK_DEV: "EXPOSE_METHOD_BLOCK_DEV",
  HOST_MOUNT: "EXPOSE_METHOD_HOST_MOUNT",
} as const;
export type valueof<T> = T[keyof T];
export type EXPOSE_METHOD = valueof<typeof EXPOSE_METHOD>;

interface BlockRegistry {
  // Called exactly once on agent restart/start
  // Must cleanup after an unclean shutdown
  initializeRegistry(): Promise<void>;
  // Hides every block device/mount managed by the registry
  hideEverything(): Promise<void>;
  // Loads an OCI layout image
  // ociDumpPath must be on the same partition as the block registry
  // Layers will be hardlinked into the registry
  loadImageFromDisk(ociDumpPath: string, outputId: IdempotenceKey): Promise<ImageId>;
  // Loads an OCI image from a remote registry
  loadImageFromRemoteRepo(ref: string, outputId: IdempotenceKey, opts: {
      // Skip TLS when accessing the registry
      skipVerifyTls?: boolean;
      // When in lazy pulling mode whether to download the entire blobs in the background
      disableObdDownload?: boolean;
      // Enable lazy pulling mode
      enableObdLazyPulling?: boolean;
      // Specifies the size threshold bellow which layers will always be downloaded eagerly
      eagerLayerDownloadThreshold?: number;
    }): Promise<ImageId>;
  // Creates an RW layer on top of an image
  // If no image was given then creates an empty container
  // mkfs - if true then creates an filesystem on the block device
  // sizeInGB - max size of the layer
  // Will throw if imageId !== void 0 and mkfs === true
  createContainer(imageId: ImageId | undefined, outputId: IdempotenceKey, opts: { mkfs: boolean; sizeInGB: number }): Promise<ContainerId>;
  // Converts the RW layer back into a RO layer, If removeContainer is set this deletes the container
  commitContainer(containerId: Container, outputId: IdempotenceKey, opts: { removeContainer: boolean }): Promise<ImageId>
  // Gets the TCMU subtype of the registry
  getTCMUSubtype(): Promise<string>
  // Gets the Host Bus Target address of the block devices managed by the registry
  // Given this address and the lun id of a TCMU storage object block device one might uniquely determine the corresponding block device
  getTCMLoopHostBusTarget(): Promise<string>

  // Exposes the given Image/Container to the host system. Images will be exposed as RO block devices, Containers as RW block devices.
  expose(
    contentId: ImageId,
    method: typeof EXPOSE_METHOD.HOST_MOUNT,
  ): Promise<{ mountPoint: string; readonly: true }>;
  expose(
    contentId: ContainerId,
    method: typeof EXPOSE_METHOD.HOST_MOUNT,
  ): Promise<{ mountPoint: string; readonly: false }>;
  expose(
    contentId: ImageId,
    method: typeof EXPOSE_METHOD.BLOCK_DEV,
  ): Promise<{ device: string; readonly: true }>;
  expose(
    contentId: ContainerId,
    method: typeof EXPOSE_METHOD.BLOCK_DEV,
  ): Promise<{ device: string; readonly: false }>;
  // Hides the given Image/Container from the host system
  hide(contentId: ImageId | ContainerId): Promise<void>

  // Pushes a given image to a remote OCI compatible registry
  pushImage(
    imageId: ImageId,
    opts: { tag: string; username: string; password: string },
  ): Promise<void>

  /** Enumeration */
  // Checks if the given contentId is available in the block registry
  async hasContent(contentId: ImageId | ContainerId): Promise<boolean>;
  // Checks if the given contentId was exposed from the block registry
  async wasExposed(contentId: ImageId | ContainerId): Promise<boolean>;
  // Returns a list of exposed contentId's of the given type
  async listExposedContent<T extends CONTENT_TYPE>(
    contentType: T = CONTENT_TYPE.ANY as T,
  ): Promise<
    PickOne<
      {
        [CONTENT_TYPE.ANY]: ImageId | ContainerId;
        [CONTENT_TYPE.IMAGE]: ImageId;
        [CONTENT_TYPE.CONTAINER]: ContainerId;
      },
      T
    >[]
  >;
  // Returns a list of available contentId's of the given type
  async listContent<T extends CONTENT_TYPE>(
    contentType: T = CONTENT_TYPE.ANY as T,
  ): Promise<
    PickOne<
      {
        [CONTENT_TYPE.ANY]: ImageId | ContainerId;
        [CONTENT_TYPE.IMAGE]: ImageId;
        [CONTENT_TYPE.CONTAINER]: ContainerId;
      },
      T
    >[]
  >;

  /** Storage management */
  // Removes the given content from the registry
  async removeContent(contentId: ImageId | ContainerId): Promise<void>;
  // Garbage collect unreferenced data from the registry, might do nothing
  async garbageCollect(): Promise<void>;
  // Self report storage usage of various registry components
  // Returns an object with the keys as the subsystem name an the values as the subsystem storage usage
  async estimateStorageUsage(): Promise<Record<string, bigint>>;
}
```

### Transferring Images between Buildfs and the Block Registry

Use virtio-fs:

1. Attach an empty agent directory to the buildfs VM using virtio-fs (preferably on the same filesystem as the block registry)
2. Buildfs exports the image to the shared directory as OCI layout
3. Agent loads the image into the block registry using loadImageFromDisk

### OverlayBD Block Registry Storage

This is the current implementation using OverlayBD.

```bash
<BLOCK_REGISTRY_DIR>/tcmu_subtype # TCMU subtype for this registry
<BLOCK_REGISTRY_DIR>/block_config/<ContentId> # Metadata for the content, contains the OverlayBD device config along with the OCI manifest of the image
<BLOCK_REGISTRY_DIR>/layers/<content hash>/* # OverlayBD RO layers, either eager, lazy or sealed layers
<BLOCK_REGISTRY_DIR>/containers/<ContainerId>/* # OverlayBD RW sparse layers
<BLOCK_REGISTRY_DIR>/run/* # On Disk temporary files
<BLOCK_REGISTRY_DIR>/mounts/<ContentId> # MountPoints when exposing using a mount
<BLOCK_REGISTRY_DIR>/overlaybd.json # OverlayBD config
<BLOCK_REGISTRY_DIR>/logs # OverlayBD log files
<BLOCK_REGISTRY_DIR>/obd_registry_cache # OverlayBD registry cache
<BLOCK_REGISTRY_DIR>/obd_gzip_cache # OverlayBD gzip cache
```
