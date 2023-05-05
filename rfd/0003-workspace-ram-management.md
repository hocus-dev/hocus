---
authors: Grzegorz Uriasz (gorbak25@gmail.com)
state: draft
---

# RFD 3 - Workspace RAM Management

## What

Specify RAM management in workspaces so Hocus VMs feel like containers.

## Why

To increase the density of workspaces on a single machine and to minimize the footprint of workspaces.

## Details

### Containers vs MicroVM's vs Hocus Workspaces

Containers are much more lightweight than VM's due to their shared host kernel and page cache. When running a container, the workload has full access to the host resources, and efficient resource sharing is easy. VMs, on the other hand, run a fully separate kernel and are always designed to use every MB of RAM that was given to them. Workloads running in VMs, contrary to containers, might be using up 1GB of RAM but 15GB in various caches, which are never freed and usually duplicated on the host kernel, resulting in very high memory usage on the host and decreasing the density of workspaces. MicroVM's are short-lived, so they avoid the problem of page caches piling up altogether. Hocus workspaces are meant to be operating for a very long time and have periods of inactivity, like a developer having 3 workspaces open but only using 1 of them or leaving workspaces on during their lunch break or overnight. Hocus workspaces are designed to autoscale their RAM during periods of intense usage (like compiling a project) and to release back their RAM as soon as the usage comes down.

### Manual ballooning

Previously, the only option for dynamic VM RAM management was memory ballooning where the hypervisor might manually readjust the size of the VM's RAM. Unfortunately, this introduces a ton of complexity in the hypervisor and is a half measure, not a solution, as creating a RAM usage policy which actually works well is very hard. Even if a good policy was designed and implemented, the inflation/deflation of the balloon is slow, unreliable, and unsuited for our use case. We want VMs to access most of the Host resources like containers and quickly give them back when unneeded.

### Free page reporting

The solution to this problem is Free Page Reporting[^1], a feature in `virtio-balloon` available since the 5.7 kernel, which gives a primitive in which the VM might give back their unused RAM to the hypervisor without manual intervention. By default, free page reporting operates in 4MB segments on x86_64, limiting its effectiveness without other measures. Since the 5.14 kernel, it's possible to override the segment size and for free page reporting to operate on a per-page granularity[^2]. In my testing, free page reporting with `page_reporting.page_reporting_order=0` works well and has acceptable overhead.

### Limiting page cache usage via `virtio-pmem` and DAX

I tested this possibility, and this doesn't work well:

- For a 0.5TB sparse disk, the RAM overhead for the VM is 8GB, which is prohibitively large.
- No support for discard, which results in the sparse disk files always growing in size.
- Weird performance characteristics and longer boot time[^3].

### THP (Transparent Huge Pages)

Will always be disabled by default in Hocus workspaces to increase the effectiveness of free page reporting. THP might be enabled on the host, but we recommend disabling it for production usage.

### KSM (Kernel Same Page Merging)

Workspaces running on a single machine will usually run the same kernel, IDE version, and edit the same code. This setup is ideal for KSM. We recommend enabling KSM on the host machine, but it's not a requirement for Hocus.

### DAMON (Data Access MONitor)

For free page reporting to be effective, the workspace needs the ability to drop page caches it doesn't need. By default, Linux is designed to consume as much RAM as possible and never release it back until there is some memory pressure. Hocus workspaces use DAMON RECLAIM, available since the 5.16 kernel[^4], to proactively reclaim unused page caches. In our testing, this releases most of the caches the VM uses, but as DAMON is a very new subsystem in the kernel, there is still a lot of room for improvements[^5].

### PSI-based autosizing

DAMON is able to reclaim unused caches but won't prevent the page cache from growing uncontrollably as the VM is rarely under high memory pressure. To ensure RAM is only allocated to the VM when it's actually needed, Hocus Workspaces ship [Sempai](https://github.com/facebookincubator/senpai), which is responsible for autosizing the system cgroup to ensure the VM is always under some kind of memory pressure. Sempai uses the PSI kernel mechanism to determine whether the workspace is under memory pressure and needs to increase/decrease its memory limits.

### Memlocking critical binaries

Hocus tries to reclaim as much of the page cache as possible and as quickly as possible. Executable code is located in the page cache, and as a result, a developer might lose access to their workspace under high memory pressure. To ensure they do not lose access to the workspace, we employ [prelockd](https://github.com/hakavlad/prelockd) to ensure critical system binaries like `sshd` are never evicted from the page cache.

### Using swap on the host

Hocus is designed to run a ton of workspaces on a single machine as the usage pattern of dev machines is high usage spikes followed by periods of inactivity. In the unlikely event multiple developers run multiple heavy jobs at the same time, exceeding the available memory on the host machine, the OOM killer will kill some workspaces. If that's unwanted, then we recommend having swap enabled on the host machine to swap out some of the workspaces and give KSM time to deduplicate the pages of the new jobs.

### Guest kernel version

For now, Hocus Workspaces will ship with the 6.2 kernel. This might be extended in the future down to the 5.16 kernel.

[^1]: https://github.com/torvalds/linux/commit/b0c504f154718904ae49349147e3b7e6ae91ffdc
[^2]: https://github.com/torvalds/linux/commit/f58780a8e3851edae5bafb7d3af19425308a37f5
[^3]: https://github.com/hocus-dev/hocus/pull/59
[^4]: https://github.com/torvalds/linux/commit/43b0536cb4710e7bb591edfda7e68a1c327a3409
[^5]: https://lore.kernel.org/damon/20230504171749.89225-1-sj@kernel.org/T/#t
