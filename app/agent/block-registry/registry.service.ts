import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

import type { Static, TSchema } from "@sinclair/typebox";
import { type DefaultLogger } from "@temporalio/worker";
import { flock } from "fs-ext";
import type { A, Any } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

import { doesFileExist, execCmd } from "../utils";

import { HOCUS_TCMU_HBA, HOCUS_TCM_LOOP_PORT, HOCUS_TCM_LOOP_WWN } from "./registry.const";
import type { OBDConfig, OCIDescriptor, OCIImageIndex, OCIImageManifest } from "./validators";
import { OBDConfigValidator } from "./validators";
import { OCIImageIndexValidator, OCIImageManifestValidator } from "./validators";

import { type Config } from "~/config";
import { GroupError } from "~/group-error";
import type { Validator } from "~/schema/utils.server";
import { Token } from "~/token";
import type { valueof } from "~/types/utils";
import { waitForPromises, sleep } from "~/utils.shared";

export type ImageId = A.Type<`im_${string}`, "image">;
export type ContainerId = A.Type<`ct_${string}`, "container">;

export const EXPOSE_METHOD = {
  BLOCK_DEV: "EXPOSE_METHOD_BLOCK_DEV",
  HOST_MOUNT: "EXPOSE_METHOD_HOST_MOUNT",
} as const;
export type EXPOSE_METHOD = valueof<typeof EXPOSE_METHOD>;

const catchIgnore = (toIgnore: string) => (err: any) => {
  if (!err?.message?.startsWith(toIgnore)) throw err;
};

const catchAlreadyExists = catchIgnore("EEXIST");

export async function readJsonFileOfType<T extends TSchema>(
  path: string,
  validator: Validator<T>,
): Promise<Any.Compute<Static<T>>> {
  return validator.Parse(JSON.parse(await fs.readFile(path, { encoding: "utf-8" })));
}

export class BlockRegistryService {
  static inject = [Token.Logger, Token.Config] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;
  private readonly paths: {
    root: string;
    tcmuSubtype: string;
    blockConfig: string;
    layers: string;
    containers: string;
    images: string;
    run: string;
    mounts: string;
    sharedOCIBlobsDir: string;
    _sharedOCIBlobsDirSha256: string;
    tcmLoopTarget: string;
    tcmuHBA: string;
    logs: string;
    obdRegistryCache: string;
    obdGzipCache: string;
  };

  constructor(private readonly logger: DefaultLogger, config: Config) {
    this.agentConfig = config.agent();
    const root = this.agentConfig.blockRegistryRoot;
    const configfs = this.agentConfig.blockRegistryConfigFsPath;
    this.paths = {
      // ROOT folder of the block registry
      root,
      // File with the tcmu subtype
      tcmuSubtype: path.join(root, "tcmu_subtype"),
      // Folder with overlaybd configs for images and containers
      blockConfig: path.join(root, "block_config"),
      // RO Layer storage
      layers: path.join(root, "layers"),
      // RW Layer storage
      containers: path.join(root, "containers"),
      // OCI Image manifest storage
      images: path.join(root, "images"),
      // Directory for anything temporary which should be nuked after a restart
      // This can't be /tmp as I need the directory to be on the same partition as the registry
      // I'm abusing hardlinks to create synchronization primitives
      // The entire registry is mostly lockless
      // (We have a per imageId/containerId flock on configfs in the expose method, due to a data corruption kernel bug),
      // wait free and all operations on it are idempotent
      run: path.join(root, "run"),
      // Filesystem mounts
      mounts: path.join(root, "mounts"),
      // OCI layout blob dir, used for downloading images from OCI registries
      sharedOCIBlobsDir: path.join(root, "blobs"),
      // Only to create it ahead of time
      _sharedOCIBlobsDirSha256: path.join(root, "blobs/sha256"),
      // ConfigFS tcm_loop
      tcmLoopTarget: path.join(
        configfs,
        "target/loopback",
        HOCUS_TCM_LOOP_WWN,
        HOCUS_TCM_LOOP_PORT,
      ),
      // ConfigFS target_core_user
      tcmuHBA: path.join(configfs, "target/core", HOCUS_TCMU_HBA),
      // Overlaybd directories, important to not hit overlayfs but a proper volume
      logs: path.join(root, "logs"),
      obdRegistryCache: path.join(root, "obd_registry_cache"),
      obdGzipCache: path.join(root, "obd_gzip_cache"),
    };
  }

  static genTCMUSubtype(length = 14): string {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charsetLength = charset.length;
    const randomValues = new Uint32Array(length);
    crypto.webcrypto.getRandomValues(randomValues);
    return Array.from(randomValues, (value) => charset[value % charsetLength]).join("");
  }

  private genRandId(): string {
    return uuidv4();
  }

  private genImageId(outputId: string): ImageId {
    return ("im_" + outputId) as ImageId;
  }

  private genContainerId(outputId: string): ContainerId {
    return ("ct_" + outputId) as ContainerId;
  }

  // Called once after agent restart/start
  async initializeRegistry(): Promise<void> {
    // Before doing anything first ensure the environment is properly set up
    // Otherwise we will hang forever, we want to early exit if the agent
    // is improperly set up and prone to hang forever
    // 1. Check if /sys/kernel/config is a mount point
    const configFSPath = this.agentConfig.blockRegistryConfigFsPath;
    try {
      await execCmd("mountpoint", "-q", configFSPath);
    } catch (err) {
      const msg = `Unable to find ConfigFS at ${configFSPath}`;
      this.logger.error(msg);
      throw new GroupError([new Error(msg), err]);
    }
    // 2. Check if target_core_user kernel module was loaded
    try {
      const version = await fs.readFile(path.join(configFSPath, "target", "version"));
      this.logger.info(`Found TCMU: ${version}`);
    } catch (err) {
      const msg = `Looks like target_core_user was not loaded`;
      this.logger.error(msg);
      throw new GroupError([new Error(msg), err]);
    }

    // 3. Check if tcm_loop kernel module was loaded
    try {
      const version = await fs.readFile(path.join(configFSPath, "target", "loopback", "version"));
      this.logger.info(`Found TCM LOOP: ${version}`);
    } catch (err) {
      const msg = `Looks like tcm_loop was not loaded`;
      this.logger.error(msg);
      throw new GroupError([new Error(msg), err]);
    }

    // 4. Check that the kernel has support for scsi disks
    try {
      await fs.stat("/sys/bus/scsi/drivers/sd");
    } catch (err) {
      const msg = `Looks like the kernel does not support scsi disks`;
      this.logger.error(msg);
      throw new GroupError([new Error(msg), err]);
    }

    // Now proceed with the setup, it should not hang
    // We are after a restart, nuke anything temporary
    await fs.rm(this.paths.run, { recursive: true, force: true });

    // Ensure the directory structure is ok and generate the TCMU subtype which will handle the registry
    const tasks = [];
    for (const _key in this.paths) {
      const key = _key as keyof typeof this.paths;
      const requiredPath = this.paths[key];
      tasks.push(
        fs.stat(requiredPath).catch(async (err: any) => {
          if (!err?.message?.startsWith("ENOENT")) throw err;
          await fs.mkdir(path.dirname(requiredPath), { recursive: true }).catch(catchAlreadyExists);
          if (key === "tcmuSubtype")
            await fs
              .writeFile(requiredPath, BlockRegistryService.genTCMUSubtype() + "\n")
              .catch(catchAlreadyExists);
          else {
            await fs.mkdir(requiredPath).catch(catchAlreadyExists);
          }
        }),
      );
    }
    await waitForPromises(tasks);

    // This sets the SCSI-iSCSI IT Nexus to the TCM_LOOP WWN
    // I have no idea why this is necessary but no block device will appear
    // without setting the Nexus. Good to play some starcraft :)
    // Please don't remove this line or things will break.
    // If you dear reader know what this does then please
    // send us a PR updating this comment :)
    await fs
      .writeFile(path.join(this.paths.tcmLoopTarget, "nexus"), HOCUS_TCM_LOOP_WWN)
      .catch(catchAlreadyExists);

    // Write a config for overlaybd-tcmu
    await fs.writeFile(
      path.join(this.paths.root, "overlaybd.json"),
      JSON.stringify({
        tcmuSubtype: await this.getTCMUSubtype(),
        logConfig: {
          logLevel: 1,
          logPath: path.join(this.paths.logs, "overlaybd.log"),
        },
        cacheConfig: {
          cacheType: "file",
          cacheDir: this.paths.obdRegistryCache,
          cacheSizeGB: 4,
        },
        gzipCacheConfig: {
          enable: true,
          cacheDir: this.paths.obdGzipCache,
          cacheSizeGB: 4,
        },
        credentialConfig: {
          mode: "file",
          path: "/opt/overlaybd/cred.json",
        },
        ioEngine: 0,
        download: {
          enable: false,
          delay: 600,
          delayExtra: 30,
          maxMBps: 100,
        },
        p2pConfig: {
          enable: false,
          address: "localhost:19145/dadip2p",
        },
        exporterConfig: {
          enable: false,
          uriPrefix: "/metrics",
          port: 9863,
          updateInterval: 60000000,
        },
        enableAudit: true,
        auditPath: path.join(this.paths.logs, "overlaybd-audit.log"),
      }) + "\n",
      { flag: "w" },
    );

    // Some kernels will have 2**16 luns to work with, some 2**8, some 2**64, sometimes it will depend on the kernel config :p
    // For now I've hardcoded 64 bits which is true for new kernels but the rest of the code properly handles hash collisions
    // when we have less than 2**64 luns to work with
    // There may be up to 8 targets per HBA, also we may have multiple HBA's. If compatibility in 2**8 luns mode would be required
    // then we may just have 8 HBA's each with 8 targets each with 256 luns which would give us 16k disks to work with.
    // Also in 2**16 mode with 8 targets we would have 0.5kk disks to work with
    // https://access.redhat.com/solutions/5120951
    // Here i'm sanity checking that lun_18446744073709551615 works but lun_18446744073709551616 fails so we're in 64 bit mode :)
    // the rest of the code treats lun_(2**64 - 1) as reserved and won't place any storage object there
    const shouldWorkLun = path.join(this.paths.tcmLoopTarget, `lun/lun_${2n ** 64n - 1n}`);
    const shouldNotWorkLun = path.join(this.paths.tcmLoopTarget, `lun/lun_${2n ** 64n}`);
    const cleanupF = async () => {
      await waitForPromises([
        fs.rmdir(shouldWorkLun).catch(catchIgnore("ENOENT")),
        fs.rmdir(shouldNotWorkLun).catch(catchIgnore("ENOENT")),
      ]);
    };
    await cleanupF();
    try {
      await fs
        .mkdir(shouldNotWorkLun)
        .then(() => {
          throw new Error("Lun ID is bigger than 64 bits");
        })
        .catch(catchIgnore("ERANGE"));
      await fs.mkdir(shouldWorkLun).catch((err: any) => {
        if (err?.message?.startsWith("EEXIST")) return;
        err.message = `Lun ID is smaller than 64 bits.\n${err.message}`;
        throw err;
      });
    } finally {
      await cleanupF();
    }

    // Ensure scsi scan is in sync mode, don't even try async mode for Hocus...
    const scanMode = await fs.readFile("/sys/module/scsi_mod/parameters/scan", "utf8");
    if (scanMode !== "sync\n") {
      throw new Error(
        `Kernel SCSI in ${scanMode} scan mode, Hocus refusing to operate. Please enable sync mode`,
      );
    }

    await this.hideEverything();
  }

  // Unmounts everything and hides all block devices
  // Used during restart and for tests
  async hideEverything(): Promise<void> {
    // We are after an restart, we need to cleanup all block devices/mounts we were managing in the past
    // For that do a full HBA scan
    const tcmuSubtype = await this.getTCMUSubtype();
    const dirs = await fs.readdir(this.paths.tcmuHBA);
    await waitForPromises(
      dirs
        .filter((tcmuStorageObjectId) => tcmuStorageObjectId.startsWith(`${tcmuSubtype}_`))
        .map((tcmuStorageObjectId) => tcmuStorageObjectId.substring(tcmuSubtype.length + 1))
        .map((registryId) => this.hide(registryId as ImageId | ContainerId)),
    );
  }

  async loadImageFromDisk(ociDumpPath: string, outputId: string): Promise<ImageId> {
    return await this.loadLocalOCIImage(
      this.genImageId(outputId),
      `${path.join(ociDumpPath, "index.json")}`,
      `${path.join(ociDumpPath, "blobs")}`,
    );
  }

  // Mostly for convenience :)
  async loadImageFromRemoteRepo(ref: string, outputId: string): Promise<ImageId> {
    const imageId = this.genImageId(outputId);
    const imageIndexDir = path.join(this.paths.run, "ingest-" + this.genRandId());
    try {
      // Get the image for the current platform from the remote repo
      // This will only download blobs we actually need due to the shared blob dir <3
      // Also skopeo properly handles concurrent pulls with a shared blob dir <3
      // This will place the image index in a random directory
      await execCmd(
        "skopeo",
        "copy",
        ...(process.env.OCI_PROXY ? ["--src-tls-verify=false"] : []),
        "--multi-arch",
        "system",
        "--dest-oci-accept-uncompressed-layers",
        "--dest-shared-blob-dir",
        this.paths.sharedOCIBlobsDir,
        `docker://${ref}`,
        `oci:${imageIndexDir}`,
      );

      return await this.loadLocalOCIImage(
        imageId,
        `${path.join(imageIndexDir, "index.json")}`,
        this.paths.sharedOCIBlobsDir,
      );
    } finally {
      // The only thing this directory holds is the index file :P
      // Nothing bad will happen if that index is not deleted
      await fs.rm(imageIndexDir, { force: true, recursive: true });
    }
  }

  private getPathToBlob(ociBlobsDir: string, descriptor: OCIDescriptor): string {
    const [algo, digest] = descriptor.digest.split(":");
    return path.join(ociBlobsDir, algo, digest);
  }

  private async loadLocalOCIImage(
    imageId: ImageId,
    ociIndexPath: string,
    ociBlobsDir: string,
  ): Promise<ImageId> {
    const index: OCIImageIndex = await readJsonFileOfType(ociIndexPath, OCIImageIndexValidator);
    // FIXME: Analyze every manifest or select the proper manifest based on platform :)
    if (index.manifests.length > 1) {
      throw new Error("Unsupported multi platform and multi format images");
    }
    const manifestDescriptor: OCIDescriptor = index.manifests[0];
    const manifest: OCIImageManifest = await readJsonFileOfType(
      this.getPathToBlob(ociBlobsDir, manifestDescriptor),
      OCIImageManifestValidator,
    );

    // Now check if that image is in overlaybd format, no fastoci support cause it's slow
    // Also we would need to pull another image for that
    for (const layerDescriptor of manifest.layers) {
      if (
        // For now assume that we will operate without compression, this is still 2x better than COMPRESSED overlayfs images....
        layerDescriptor.mediaType !== "application/vnd.oci.image.layer.v1.tar" ||
        // Assume that layers without annotations are definitely not from obd
        layerDescriptor.annotations === void 0 ||
        // This annotation is present with obd layers
        (layerDescriptor.annotations as any)["containerd.io/snapshot/overlaybd/blob-digest"] ===
          void 0
      ) {
        throw new Error(`Unsupported layer ${JSON.stringify(layerDescriptor)}`);
      }
    }

    // OK great! We know that we deal with an OverlayBD OCI image, time to load it into the blob store :)
    return await this._loadLocalOCIImage(
      imageId,
      manifest,
      manifest.layers.map((layerDescriptor) => [
        this.getPathToBlob(ociBlobsDir, layerDescriptor),
        layerDescriptor,
      ]),
    );
  }

  private async _loadLocalOCIImage(
    imageId: ImageId,
    manifest: OCIImageManifest,
    layersToLoad: [string, OCIDescriptor][],
  ): Promise<ImageId> {
    // We have the data locally so this should be fairly quick
    for (const [layerPath, layerDescriptor] of layersToLoad) {
      await this.loadLocalLayer(layerPath, layerDescriptor);
    }

    // Ok the blobs were loaded, time to write the image manifest :)
    if (
      !(await this.idempotentConfigWrite<OCIImageManifest>(
        manifest,
        path.join(this.paths.images, imageId),
      ))
    ) {
      throw new Error(`Image with id ${imageId} already exists`);
    }

    // Ok, almost done, generate a config for OBD
    await this.idempotentConfigWrite<OBDConfig>(
      {
        lowers: this.imageManifestToOBDLowers(manifest),
        resultFile: path.join(this.paths.run, "obd-result-" + imageId),
        hocusImageId: imageId,
      },
      path.join(this.paths.blockConfig, imageId),
    );

    return imageId;
  }

  private async loadLocalLayer(srcPath: string, layerDescriptor: OCIDescriptor): Promise<void> {
    // Path to the blob in the ingest
    const sharedOCIBlobPath = this.getPathToBlob(this.paths.sharedOCIBlobsDir, layerDescriptor);
    const dstDir = path.join(this.paths.layers, layerDescriptor.digest);
    await fs.mkdir(dstDir).catch(catchAlreadyExists);
    // This should be the root of the layer, hardlinks should point to that inode
    const dstPath = path.join(dstDir, "layer.tar");
    // Hardlink the blob from the src to the layers directory
    if (srcPath !== dstPath) {
      await fs.link(srcPath, dstPath).catch(async (err) => {
        if (!err?.message?.startsWith("EEXIST")) throw err;
        await this.forceReplaceWithHardlink(dstPath, srcPath);
      });
    }

    // If a blob was loaded out of band place it in the shared oci dir :)
    if (sharedOCIBlobPath !== srcPath) {
      await this.forceReplaceWithHardlink(dstPath, sharedOCIBlobPath);
    }
  }

  // Forcefully replaces the destination file with a hardlink to the source file
  private async forceReplaceWithHardlink(srcPath: string, dstPath: string): Promise<void> {
    await this.withTmpFile(async (tmpPath) => {
      await fs.link(srcPath, tmpPath);
      await fs.rename(tmpPath, dstPath);
    });
  }

  // Writes the given content to dstPath, returns true only if dstPath contains the given content, false otherwise
  // Essentially a one shot consensus object using POSIX primitives
  private async idempotentConfigWrite<T>(jsonSerializable: T, dstPath: string): Promise<boolean> {
    const content = JSON.stringify(jsonSerializable) + "\n";
    return await this.withTmpFile(async (tmpPath) => {
      await fs.writeFile(tmpPath, content);
      // Love that POSIX specifies link as an atomic filesystem operation
      // If multiple loads with the same ID occur at the same time only one of them will win the race
      return await fs
        .link(tmpPath, dstPath)
        .then(() => {
          return true;
        })
        .catch(async (err) => {
          if (!err?.message?.startsWith("EEXIST")) throw err;
          // Check for idempotence
          if (content === (await fs.readFile(dstPath, "utf-8"))) {
            return true;
          }
          return false;
        });
    });
  }

  // TODO: Perhaps use open(..., O_TMPFILE | ...) here?
  private async withTmpFile<T>(fn: (tmpPath: string) => Promise<T>): Promise<T> {
    const tmpPath = path.join(this.paths.run, "tmp-" + this.genRandId());
    try {
      return await fn(tmpPath);
    } finally {
      await fs.unlink(tmpPath).catch(() => {
        void 0;
      });
    }
  }

  private async imageIdToOBDLowers(imageId?: ImageId): Promise<OBDConfig["lowers"]> {
    if (imageId === void 0) {
      return [];
    }
    const manifest: OCIImageManifest = await readJsonFileOfType(
      path.join(this.paths.images, imageId),
      OCIImageManifestValidator,
    );
    return this.imageManifestToOBDLowers(manifest);
  }

  private imageManifestToOBDLowers(manifest: OCIImageManifest): OBDConfig["lowers"] {
    return manifest.layers.map((layerDescriptor) => ({
      file: path.join(this.paths.layers, layerDescriptor.digest, "layer.tar"),
    }));
  }

  public async createContainer(
    imageId: ImageId | undefined,
    outputId: string,
    opts: { mkfs: boolean; sizeInGB: number } = { mkfs: false, sizeInGB: 64 },
  ): Promise<ContainerId> {
    if (imageId !== void 0 && !imageId.startsWith("im_")) {
      throw new Error(`Invalid imageId: ${imageId}`);
    }
    const t1 = performance.now();
    const containerId = this.genContainerId(outputId);
    const lowers = await this.imageIdToOBDLowers(imageId);
    const dataPath = path.join(this.paths.containers, containerId, "data");
    const indexPath = path.join(this.paths.containers, containerId, "index");
    await fs.mkdir(path.join(this.paths.containers, containerId)).catch(catchAlreadyExists);
    await this.withTmpFile(async (tmpDataPath) => {
      await this.withTmpFile(async (tmpIndexPath) => {
        // TODO: Set the parent uuid, the only reason i did not do it right now is that i don't want to rewrite the algo for converting layer_digest -> obd_uuid
        // FIXME: For now hardcode the size to 64GB as the base images are hardcoded to this size
        await execCmd(
          "/opt/overlaybd/bin/overlaybd-create",
          "-s",
          ...(opts.mkfs ? ["--mkfs"] : []),
          tmpDataPath,
          tmpIndexPath,
          opts.sizeInGB.toString(),
        );
        await fs.link(tmpDataPath, dataPath).catch(catchAlreadyExists);
        await fs.link(tmpIndexPath, indexPath).catch(catchAlreadyExists);
      });
    });

    if (
      !(await this.idempotentConfigWrite<OBDConfig>(
        {
          lowers,
          upper: { index: indexPath, data: dataPath },
          resultFile: path.join(this.paths.run, "obd-result-" + containerId),
          hocusImageId: imageId,
        },
        path.join(this.paths.blockConfig, containerId),
      ))
    ) {
      throw new Error(`Container with id ${containerId} already exists`);
    }

    this.logger.info(
      `Creation of ${containerId}${imageId ? " on top of " + imageId : ""} took: ${(
        performance.now() - t1
      ).toFixed(2)} ms`,
    );

    return containerId;
  }

  public async commitContainer(containerId: ContainerId, outputId: string): Promise<ImageId> {
    if (!containerId.startsWith("ct_")) {
      throw new Error(`Invalid containerId: ${containerId}`);
    }
    const imageId = this.genImageId(outputId);

    // If the container does not exist and the output image exists we do nothing due to idempotence
    const outputImageExists = await doesFileExist(path.join(this.paths.images, imageId));
    const containerExists = await doesFileExist(path.join(this.paths.containers, containerId));

    // We have 4 cases:
    // - If the output image exists and we don't have the container then:
    //   * We can't verify whether we have an imageId collision or we just restarted an interrupted commit
    //   * Assume there are no id collisions and we can tell the caller that the operation was done
    // - If the output image exists and we have the container then:
    //   * The rest of the code will ensure that the image was created as the result of the container
    // - If we have no image but have an container:
    //   * Just proceed with the commit as usual
    // - If we have no image and no container
    //   * Throw an error
    if (outputImageExists && !containerExists) {
      this.logger.info(`Assuming that the commit of ${containerExists} produced ${imageId}.`);
      return imageId;
    }
    if (!outputImageExists && !containerExists) {
      throw new Error(`Container ${containerId} not found. Nothing to commit.`);
    }

    // Ensure the container is hidden
    await this.hide(containerId);
    const obdConfig: OBDConfig = await readJsonFileOfType(
      path.join(this.paths.blockConfig, containerId),
      OBDConfigValidator,
    );

    // Sealing is not supported for sparse layers :P
    // Sealing would improve the performance a lot as we would be able to instantly start using this container as a lower layer
    // And asynchronously commit the container to the blob store
    return await this.withTmpFile(async (layerPath) => {
      if (obdConfig.upper === void 0) {
        throw new Error("Expected container, found image");
      }

      const t1 = performance.now();
      await execCmd(
        "/opt/overlaybd/bin/overlaybd-commit",
        "-z",
        "-t",
        obdConfig.upper.data,
        obdConfig.upper.index,
        layerPath,
      );
      this.logger.info(
        `obd-commit for ${containerId} took: ${(performance.now() - t1).toFixed(2)} ms`,
      );
      const layerDigest = `sha256:${(await execCmd("sha256sum", layerPath)).stdout.split(" ")[0]}`;
      const layerSize = (await fs.stat(layerPath)).size;
      const image = obdConfig.hocusImageId as ImageId | undefined;
      let manifest: OCIImageManifest = image
        ? await readJsonFileOfType(path.join(this.paths.images, image), OCIImageManifestValidator)
        : {
            schemaVersion: 2,
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            // fake config
            config: {
              mediaType: "application/vnd.oci.image.config.v1+json",
              digest: "sha256:e7c9d53532bd3d8a83a967b0331a52e1cfc2ef87873503e3967893926206801d",
              size: 1337,
            },
            layers: [],
          };
      const layerDescriptor: OCIDescriptor = {
        mediaType: "application/vnd.oci.image.layer.v1.tar",
        digest: layerDigest,
        size: layerSize,
        annotations: {
          "containerd.io/snapshot/overlaybd/blob-digest": layerDigest,
          "containerd.io/snapshot/overlaybd/blob-size": layerSize.toString(),
        },
      };
      manifest.layers.push(layerDescriptor);

      await this._loadLocalOCIImage(imageId, manifest, [[layerPath, layerDescriptor]]);
      await fs.rm(path.join(this.paths.containers, containerId), { recursive: true, force: true });
      return imageId;
    });
  }

  private _tcmuSubtype: string | undefined;
  public async getTCMUSubtype(): Promise<string> {
    if (this._tcmuSubtype === void 0) {
      this._tcmuSubtype = (await fs.readFile(this.paths.tcmuSubtype, "utf-8")).trim();
    }
    return this._tcmuSubtype;
  }

  private _tcmLoopHostBusTarget: string | undefined;
  public async getTCMLoopHostBusTarget(): Promise<string> {
    if (this._tcmLoopHostBusTarget === void 0) {
      this._tcmLoopHostBusTarget = (
        await fs.readFile(path.join(this.paths.tcmLoopTarget, "address"), "utf-8")
      ).trim();
    }
    return this._tcmLoopHostBusTarget;
  }

  // Based on https://raw.githubusercontent.com/mstdokumaci/string-hash-64/master/index.js
  public tcmuIdToLUN(tcmuStorageObjectId: string): string {
    let i = tcmuStorageObjectId.length;
    let hash1 = 5381n;
    let hash2 = 52711n;

    while (i--) {
      const char = BigInt(tcmuStorageObjectId.charCodeAt(i));
      hash1 = BigInt.asUintN(64, hash1 * 33n) ^ char;
      hash2 = BigInt.asUintN(64, hash2 * 33n) ^ char;
    }

    return BigInt.asUintN(64, hash1 * 4096n + hash2).toString();
  }

  // W-LUNS are special, if we place something on that lun
  // then kernel won't create a disk for us
  // https://github.com/torvalds/linux/blob/2d1bcbc6cd703e64caf8df314e3669b4786e008a/include/scsi/scsi.h#L61
  // https://github.com/torvalds/linux/blob/2d1bcbc6cd703e64caf8df314e3669b4786e008a/drivers/scsi/scsi_scan.c#L918
  public isWLun(lunId: string) {
    return (BigInt(lunId) & 0xff00n) === 0xc100n;
  }

  // Gets info about under which LUNs the given TCMU object was exposed on in the system
  // This will almost certainly be only one LUN, but IF the above hash function
  // (on kernels where we have less than 32 bits for the LUN id to work with)
  // hits a collision there is a possibility of temporally returning more than one
  // LUN, in that case the application should always proceed with the first LUN on the list
  // The case when this list returns 2 members for a split second:
  // 1. hash(A) === hash(B) && hash(hash(A)) != hash(hash(B))
  // 2. expose(A) -> gets mapped to LUN hash(A)
  // 3. race(hide(A), expose(B), expose(B))
  // In that case it's possible for the first expose(B) call to get hash(B)
  // and for the second call to get hash(hash(B))
  // This is not a problem as we will always proceed with the first member from the list :)
  // Essentially the kernel makes the consensus decision for us under which LUN we will find the object
  private async getTCMUAluaMembers(tcmuStorageObjectId: string): Promise<string[]> {
    const members = await fs.readFile(
      path.join(this.paths.tcmuHBA, tcmuStorageObjectId, "alua/default_tg_pt_gp/members"),
      "utf-8",
    );
    return members
      .split("\n\x00")
      .filter((member) => member.length > 0)
      .map((member) => {
        const prefix = `loopback/${HOCUS_TCM_LOOP_WWN}/${HOCUS_TCM_LOOP_PORT}/lun_`;
        if (!member.startsWith(prefix)) {
          throw new Error(
            `TCMU object ${tcmuStorageObjectId} was exposed manually under unknown ${member}. Refusing to operate.`,
          );
        }
        return member.substring(prefix.length);
      });
  }

  expose(
    what: ImageId | ContainerId,
    method: typeof EXPOSE_METHOD.HOST_MOUNT,
  ): Promise<{ mountPoint: string; readonly: boolean }>;
  expose(
    what: ImageId | ContainerId,
    method: typeof EXPOSE_METHOD.BLOCK_DEV,
  ): Promise<{ device: string; readonly: boolean }>;
  async expose(
    what: ImageId | ContainerId,
    method: EXPOSE_METHOD,
  ): Promise<{ device: string; readonly: boolean } | { mountPoint: string; readonly: boolean }> {
    if (!what.startsWith("im_") && !what.startsWith("ct_")) {
      throw new Error(`Invalid id: ${what}`);
    }
    const readonly = what.startsWith("im_");
    switch (method) {
      case EXPOSE_METHOD.HOST_MOUNT: {
        const bd = await this.expose(what, EXPOSE_METHOD.BLOCK_DEV);
        const mountPoint = path.join(this.paths.mounts, what);
        await fs.mkdir(mountPoint).catch(catchAlreadyExists);
        try {
          let flags = readonly ? ["--read-only"] : ["--read-write", "-o", "discard"];
          const t1 = performance.now();
          // TODO: Calling the mount syscall directly is much much faster
          await execCmd("mount", ...flags, bd.device, mountPoint);
          this.logger.info(`mount for ${what} took: ${(performance.now() - t1).toFixed(2)} ms`);
        } catch (err: any) {
          if (!err?.message?.includes("already mounted")) throw err;
        }
        return { mountPoint, readonly };
      }
      case EXPOSE_METHOD.BLOCK_DEV: {
        const t1 = performance.now();
        // Get the tcmuSubtype
        const tcmuSubtype = await this.getTCMUSubtype();
        const tcmuStorageObjectId = `${tcmuSubtype}_${what}`;
        const tcmuPath = path.join(this.paths.tcmuHBA, tcmuStorageObjectId);
        // Create a storage object on that HBA, if it already exists then check for a LUN
        let aluaMembers: string[] = [];
        await fs.mkdir(tcmuPath).catch(async (err) => {
          if (!err?.message?.startsWith("EEXIST")) throw err;
          // Ok check for LUN
          aluaMembers = await this.getTCMUAluaMembers(tcmuStorageObjectId);
        });
        // Check if the device was not mapped to a LUN
        if (aluaMembers.length === 0) {
          // WARNING: The upstream kernel is borked and data corruption occurs when concurrent enable requests are made
          //          There is no mutex in the kernel protecting concurrent enable requests
          //          Due to this get an exclusive flock on the enable file
          //          The fs-ext library is unmaintained and will stall the event loop when there are more than 3 concurrent flocks
          //          waiting, due to this we request a flock in unblocking mode and sleep for some time.
          //          TODO: Consider writing a rust addon for flocks cause there is no good library for this in node .-.
          const enableFd = await fs.open(path.join(tcmuPath, "enable"), "w");
          let tcmuAttachFailed = false;
          try {
            let flockAcquired = false;
            while (!flockAcquired) {
              try {
                await new Promise((resolve, reject) => {
                  flock(enableFd.fd, "exnb", (err) => {
                    if (err === void 0 || err === null) {
                      resolve(void 0);
                    } else {
                      reject(err);
                    }
                  });
                });
              } catch (err: any) {
                if (!err?.message?.startsWith("EAGAIN") && !err?.message?.startsWith("EWOULDBLOCK"))
                  throw err;
                flockAcquired = false;
                await sleep(5);
                continue;
              }
              flockAcquired = true;
            }
            // Ok we got the flock, time to proceed with the setup
            // Set the vendor for convenience, this is for filtering
            // EINVAL is thrown when the storage object is already exposed on a LUN
            //        cause after it is exposed the WWN becomes immutable
            //        this is not a problem due to idempotence
            await fs
              .writeFile(
                path.join(tcmuPath, "wwn/vpd_unit_serial"),
                `hocusbd-${tcmuStorageObjectId}`,
              )
              .catch(catchIgnore("EINVAL"));
            // WARNING: The following actions will happen during the writes:
            // 1. Kernel will create a new uio device for the storage object and send out an netlink notification to all tcmu processes
            // 2. All notified processes will check whether they have a handler for the given tcmu subtype,
            //    if so then they proceed to discover their dedicated UIO device, the discovery may fail
            //    If netlink reply is enabled(the default) all processes will send a netlink reply but only the first replay
            //    will be processed by the kernel - this is why we disable netlink replies.
            // 3. The chosen overlaybd process will read the provided config file and:
            //    a) Open and set up a shared ring buffer using the UIO device
            //    b) Open all layers, and combine them into one view
            //    c) Write the result of the setup into the result file provided in the config
            //       aka. <ROOT_DIR>/run/obd-result-<image_id or container_id>
            // Those are a lot of moving parts and not everything may work:
            // 1. If there is no TCMU process or the handler process never attaches we can't know that without extra info
            // 2. If netlink replay is enabled and the handler attached but the handler failed setting up its stuff then
            //    the enable write will fail with ENOENT besides the file existing
            // 3. If tcm_loop was attached to the tcmu storage object then you
            //    can't reconfigure anything anymore and the config writes will fail
            // 4. I managed to once get a case in bash where the enable write hanged forever
            //    and was immune to `sudo kill -9` as the process hanged in kernel space not userspace
            //    the only way for the hanged write to resume was to start a tcmu handler for that storage object
            //    This was with netlink replies enabled - that's one of the reasons we disable it
            // For now assume that:
            // 1. During a full restart all overlaybd result files were deleted
            // 2. If the TCMU process crashes then we need to perform a full restart of the agent
            // 3. If the result file tells us that the setup is ok then assume that the handler is present and attached successfully
            // 4. The config writes will finish in finite time 🤞
            // 5. The user won't race expose/hide calls with the same ID
            // FIXME: Not all kernels will support nl_reply_supported .-. We should detect that in the initialization logic
            await fs
              .writeFile(
                path.join(tcmuPath, "control"),
                `dev_config=${tcmuSubtype}/${path.join(
                  this.paths.blockConfig,
                  what,
                )},nl_reply_supported=-1`,
              )
              .catch(catchAlreadyExists);

            await enableFd.write("1").catch((err) => {
              if (!err?.message?.startsWith("EEXIST") && !err?.message?.startsWith("ENOENT"))
                throw err;
              // The TCMU process told us that he failed to set up his part of the deal
              if (err?.message?.startsWith("ENOENT")) tcmuAttachFailed = true;
            });
          } finally {
            await enableFd.close();
          }

          // Ok the device was enabled, check if obd succeeded :)
          let obdResult: string | undefined = void 0;
          // Wait up to half a second for overlaybd to setup the device
          // https://linear.app/hocus-dev/issue/HOC-204/modify-overlaybd-tcmu-to-work-without-netlink-and-expose-a-grpc-api
          for (let i = 0; i < 100; i += 1) {
            try {
              obdResult = await fs.readFile(
                path.join(this.paths.run, `obd-result-${what}`),
                "utf-8",
              );
            } catch (err) {
              if (!(err as Error).message.startsWith("ENOENT")) throw err;
              await sleep(5);
            }
          }
          if (obdResult === void 0) {
            throw new Error("Timed out waiting for overlaybd-tcmu");
          }
          // tcmuAttachFailed is for the nice case where tcmu failed successfully
          // I won't be surprised if that may happen here, better safe than sorry
          if (obdResult !== "success" || tcmuAttachFailed) {
            throw new Error(`overlaybd-tcmu failed to attach: ${obdResult}`);
          }

          // Great TCMU was set up and OBD attached, now we need to hook the storage object into tcm_loop
          // First create a new LUN, for that we need to map the tcmuStorageObjectId into a lun_id
          // This mapping may be nondeterministic as the kernel will store the mapping for us:
          // <CONFIG_FS>/target/core/<TCMU_HBA>/<TCMU_OBJECT_ID>/alua/default_tg_pt_gp/members
          // IF due to races during hash collisions multiple LUN's were created
          // we use the members file to make a consensus decision and clean up the remaining LUNs
          let lunId = this.tcmuIdToLUN(tcmuStorageObjectId);
          let lastChance: boolean = false;
          let loopDetected: boolean = false;
          let hare: string | undefined = void 0;
          let done = false;
          while (!done) {
            if (loopDetected && !lastChance) {
              throw new Error(
                `Failed to expose storage object ${tcmuStorageObjectId}, hash cycle detected hash("${tcmuStorageObjectId}") === hash(...hash("${tcmuStorageObjectId}")...)`,
              );
            }
            if (lastChance) {
              lastChance = false;
            }

            // LUN 2**64 - 1 and W-LUNs are reserved
            if (lunId !== (2n ** 64n - 1n).toString() && !this.isWLun(lunId)) {
              const lunPath = path.join(this.paths.tcmLoopTarget, "lun", `lun_${lunId}`);
              // If a hide and expose operation happens for different containers at the same time
              // Then when a hash collision occurs then it's possible that the lun gets deleted before we manage to claim it
              // in that case we just retry the operation until we see that the lun is claimed :)
              let lunClaimed = false;
              while (!lunClaimed) {
                await fs.mkdir(lunPath).catch(catchAlreadyExists);
                try {
                  await fs
                    .symlink(tcmuPath, path.join(lunPath, tcmuStorageObjectId))
                    .catch(catchAlreadyExists);
                  lunClaimed = true;
                } catch (err: any) {
                  if (!err?.message?.includes("ENOENT")) throw err;
                }
              }
              // Ok the above code ensured that the lun was claimed by someone
              // time to ensure that we are the ones who claimed the LUN
              // So let us check the symlink, if it exists then we're done
              // if it does not exist then we got a hash collision and need to move to another hash
              // and start the tortoise and hare algorithm to not end up in an infinite loop
              done = await doesFileExist(path.join(lunPath, tcmuStorageObjectId));
            }
            if (!done) {
              // Ok we got a hash collision or a reserved hash value
              // Iterate the hash function
              // This is important for 32 bit systems where due to
              // the birthday paradox 2**16 entries will have a fairly high change of collision
              // Remember that the birthday paradox tells us that when we have sqrt(2**bits) entries we need to worry about collisions
              // I use the tortoise and the hare algorithm to ensure we won't end up in an infinite loop
              if (hare === void 0) {
                // Ok this is the first invocation
                hare = this.tcmuIdToLUN(lunId);
              }
              const prevLunId = lunId;
              lunId = this.tcmuIdToLUN(lunId);
              hare = this.tcmuIdToLUN(this.tcmuIdToLUN(hare));
              if (!loopDetected && lunId === hare && prevLunId !== lunId) {
                loopDetected = true;
                lastChance = true;
              } else if (!loopDetected && lunId === hare) {
                loopDetected = true;
                lastChance = false;
              }
            }
          }

          // If collisions would not be of concern we would be done
          // Unfortunately we may have races under hash collisions so we need to ask the kernel for a consensus decision
          aluaMembers = await this.getTCMUAluaMembers(tcmuStorageObjectId);
        }
        if (aluaMembers.length === 0) {
          throw new Error(
            "Something went terribly wrong, no alua members after mapping a TCMU object to a LUN",
          );
        }
        const finalLunId = aluaMembers[0];
        if (aluaMembers.length > 1) {
          // This is the absurdly improbable case of a double expose race under a hash collision
          for (let i = 1; i < aluaMembers.length; i++) {
            const lunPath = path.join(this.paths.tcmLoopTarget, "lun", `lun_${aluaMembers[i]}`);
            const symlinkPath = path.join(lunPath, tcmuStorageObjectId);
            await fs.unlink(symlinkPath).catch(catchIgnore("ENOENT"));
            // When not empty then some other process managed to claim the LUN, this is not a problem
            await fs.rmdir(lunPath).catch(catchIgnore("ENOTEMPTY"));
          }
        }

        // Great! The LUN is final, now discover what block device maps to this LUN :)
        const hostBusTargetAddr = await this.getTCMLoopHostBusTarget();
        const fullSCSIAddr = `${hostBusTargetAddr}:${finalLunId}`;
        let disksAndPartitions: string[] = [];
        // The disks should appear instantly
        // If that's not the case and we get ENOENT then this means either:
        // - We hit a LUN which isn't working
        // - Async scsi mode is enabled
        // In async mode wait for up to 0.5s
        for (let i = 0; i < 100; i++) {
          try {
            disksAndPartitions = await fs.readdir(
              path.join("/sys/class/scsi_disk/", fullSCSIAddr, "device/block"),
            );
            break;
          } catch (err: any) {
            if (!err?.message?.startsWith("ENOENT")) throw err;
            await sleep(5);
          }
        }
        if (disksAndPartitions.length === 0) {
          throw new Error(
            `Unable to find any block device for SCSI address ${fullSCSIAddr}.\n` +
              `Does your kernel have async scsi scan enabled? Does your kernel have support for SCSI disks?`,
          );
        }

        // Block devices may contain multiple partitions on them
        // For now assume we only support a raw filesystem on the block device without a partition table
        if (disksAndPartitions.length !== 1) {
          throw new Error(`Found partitions ${disksAndPartitions}. Refusing to operate`);
        }

        this.logger.info(
          `Setting up block device for ${what} took: ${(performance.now() - t1).toFixed(2)} ms`,
        );

        return {
          device: `/dev/hocus/${disksAndPartitions[0]}`,
          readonly,
        };
      }
    }
  }

  async hide(what: ImageId | ContainerId): Promise<void> {
    if (!what.startsWith("im_") && !what.startsWith("ct_")) {
      throw new Error(`Invalid id: ${what}`);
    }
    const t1 = performance.now();
    // Ensure the device was unmounted
    const mountPoint = path.join(this.paths.mounts, what);
    const dirPresent = await doesFileExist(mountPoint);
    if (dirPresent) {
      try {
        // TODO: Calling the umount syscall directly is much much more faster
        await execCmd("umount", mountPoint);
      } catch (err: any) {
        if (!err?.message?.includes("not mounted")) throw err;
      }

      await fs.rmdir(mountPoint);
    }
    // Remove the TCMU <-> LUN mapping
    const tcmuSubtype = await this.getTCMUSubtype();
    const tcmuStorageObjectId = `${tcmuSubtype}_${what}`;
    const tcmuPath = path.join(this.paths.tcmuHBA, tcmuStorageObjectId);
    const aluaMembers = await this.getTCMUAluaMembers(tcmuStorageObjectId).catch(
      catchIgnore("ENOENT"),
    );
    if (aluaMembers === void 0) {
      // The object was already deleted
      return;
    }
    for (const member of aluaMembers) {
      const lunPath = path.join(this.paths.tcmLoopTarget, "lun", `lun_${member}`);
      const symlinkPath = path.join(lunPath, tcmuStorageObjectId);
      await fs.unlink(symlinkPath).catch(catchIgnore("ENOENT"));
      // When not empty then some other process managed to claim the LUN, this is not a problem
      await fs.rmdir(lunPath).catch((err) => {
        if (!err?.message?.startsWith("ENOENT") && !err?.message?.startsWith("ENOTEMPTY"))
          throw err;
      });
    }
    // Remove the TCMU storage object
    await fs.rmdir(tcmuPath).catch(catchIgnore("ENOENT"));
    // Remove the result file
    await fs.unlink(path.join(this.paths.run, `obd-result-${what}`)).catch(catchIgnore("ENOENT"));
    this.logger.info(`hide of ${what} took: ${(performance.now() - t1).toFixed(2)} ms`);
  }
}
