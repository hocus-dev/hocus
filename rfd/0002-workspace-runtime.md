---
authors: Grzegorz Uriasz (gorbak25@gmail.com)
state: draft
---

# RFD 2 - Workspace Runtime

## What

Defines the way Hocus runs workspaces on a host computer and applicable technologies.

## Why

Depending on the use case and the kind of resources required for workspaces, different VMMs or runtimes are applicable. In the future, the runtime layer should be configurable using a plugin/hook mechanism.

## Details

### Hard requirements for the workspace runtime

- Minimal assumptions about the host OS
  - No need to reserve huge pages
  - No need to install a layer 1 hypervisor
- Efficient RAM management
  - For containers - Host cgroups
  - For VMMs - Free page reporting
- Efficient storage
  - Online discard support

### `vhost-user-blk` vs `virtio-blk` vs `vdpa`

Some VMMs don't support discard in their `virtio-blk` driver, but they support `vhost-user-blk` or `vdpa`. Unfortunately, `vhost-user-blk` has a hard dependency on huge pages, which is highly problematic. If `vhost-user-blk` support in Hocus is introduced, it should NEVER be the default option. `vdpa`, on the other hand, introduces a lot of complexity to the system and doesn't feel like the right choice for the current project stage.

### MicroVMs vs VMs

From my testing, the benefit of microVMs quickly diminishes when one increases the VM size. The RAM overhead of the VMM when running small VMs (1 vCPU, 4GB RAM) is significant, but for larger VMs (16 vCPUs, 16-80GB RAM), the difference in overhead between "Micro" and "Full" VMs is only 10% with comparable boot times.

### Comparison of virtualization solutions

Table done as of time of writing(5th May 2023)
| Name | virtio-blk | discard | virtio-fs | free page reporting |
| ---- | ---------- | ------- | --------- | ------------------- |
| Qemu | ✅ | ✅ | ✅ | ✅ |
| Firecracker | ✅ | ❌[^1] | ✅ | ❌[^4] |
| Cloud Hypervisor | ✅ | ❌[^2] | ✅ | ✅ |
| Crosvm | ✅ | ⚠️[^3] | ✅ | ✅ |
[^1]: https://github.com/firecracker-microvm/firecracker/blob/a183614a6ce96ed61756f5e889e1396c51a61dc6/src/devices/src/virtio/block/device.rs#L247
[^2]: [Hardcoded 64kb discard sector](https://chromium.googlesource.com/chromiumos/platform/crosvm/+/e73c80f355099a38293108baf0aed9666664a6e7/devices/src/virtio/block.rs#40), essentially from my tests, discard never worked in any practical scenario.
[^3]: https://github.com/cloud-hypervisor/cloud-hypervisor/issues/5406
[^4]: https://github.com/firecracker-microvm/firecracker/blob/a183614a6ce96ed61756f5e889e1396c51a61dc6/src/devices/src/virtio/balloon/mod.rs#L39

### Runtime interface

Will be defined in the future, for now the runtime layer is non configurable.

### Hypervisor choice for now

The 0.1 release of Hocus was built on top of Firecracker. Firecracker as a serverless runtime lacks the features to deliver a great UX. Eventually we would like to move to Cloud Hypervisor, but until these 2 issues are closed we can't:

- [ ] https://github.com/cloud-hypervisor/cloud-hypervisor/issues/5406
- [ ] https://github.com/cloud-hypervisor/cloud-hypervisor/issues/5410

In the meantime Hocus will use QEMU.
