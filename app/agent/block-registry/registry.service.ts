import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

import type { Static, TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { type DefaultLogger } from "@temporalio/worker";
import type { A, Any } from "ts-toolbelt";
import { F } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

import { execCmd } from "../utils";

import {
  OBDConfig,
  OBDConfigValidator,
  OCIDescriptor,
  OCIImageIndex,
  OCIImageManifest,
} from "./validators";
import { OCIImageIndexValidator, OCIImageManifestValidator } from "./validators";

import { type Config } from "~/config";
import type { Validator } from "~/schema/utils.server";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

export type Image = A.Type<string, "image">;
export type Container = A.Type<string, "container">;

const catchAlreadyExists = (err: Error) => {
  if (!err.message.startsWith("EEXIST")) throw err;
};

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
    sharedOCIBlobsDir: string;
  };

  constructor(private readonly logger: DefaultLogger, config: Config) {
    this.agentConfig = config.agent();
    const root = this.agentConfig.blockRegistryRoot;
    this.paths = {
      root,
      tcmuSubtype: path.join(root, "tcmu_subtype"),
      blockConfig: path.join(root, "block_config"),
      layers: path.join(root, "layers"),
      containers: path.join(root, "containers"),
      images: path.join(root, "images"),
      // Directory for any temporary thing which should be nuked after a restart
      // This can't be /tmp as I need the directory to be on the same partition as the registry
      run: path.join(root, "run"),
      sharedOCIBlobsDir: path.join(root, "blobs"),
    };
  }

  static genTCMUSubtype(length = 14): string {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charsetLength = charset.length;
    const randomValues = new Uint32Array(length);
    crypto.webcrypto.getRandomValues(randomValues);
    return Array.from(randomValues, (value) => charset[value % charsetLength]).join("");
  }

  private genId(outputId?: string): string {
    return outputId ?? uuidv4();
  }

  // Called once after agent restart/start
  async initializeRegistry(): Promise<void> {
    // We are after an restart, nuke anything temporary
    await execCmd("rm", "-rf", this.paths.run);

    // Ensure the directory structure is ok and generate the TCMU subtype which will handle the registry
    const tasks = [];
    for (const _key in this.paths) {
      const key = _key as keyof typeof this.paths;
      const requiredPath = this.paths[key];
      tasks.push(
        fs.stat(requiredPath).catch(async (err: Error) => {
          if (!err.message.startsWith("ENOENT")) throw err;
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

    // [TODO] We are after an restart, we need to check the state of block devices we are managing
  }

  async loadImageFromDisk(ociDumpPath: string, outputId?: string): Promise<Image> {
    return await this.loadLocalOCIImage(
      this.genId(outputId),
      `${path.join(ociDumpPath, "index.json")}`,
      `${path.join(ociDumpPath, "blobs")}`,
    );
  }

  // Mostly for convenience :)
  async loadImageFromRemoteRepo(ref: string, outputId?: string): Promise<Image> {
    outputId = this.genId(outputId);
    const imageIndexDir = path.join(this.paths.run, "ingest-" + this.genId());
    try {
      // Get the image for the current platform from the remote repo
      // This will only download blobs we actually need due to the shared blob dir <3
      // Also skopeo properly handles concurrent pulls with a shared blob dir <3
      // This will place the image index in a random directory
      execCmd(
        "skopeo",
        "copy",
        "--multi-arch",
        "system",
        "--dest-oci-accept-uncompressed-layers",
        "--dest-shared-blob-dir",
        this.paths.sharedOCIBlobsDir,
        `docker://${ref}`,
        `oci:${imageIndexDir}`,
      );

      return await this.loadLocalOCIImage(
        outputId,
        `${path.join(imageIndexDir, "index.json")}`,
        this.paths.sharedOCIBlobsDir,
      );
    } finally {
      // The only thing this directory holds is the index file :P
      // Nothing bad will happen if that index is not deleted
      await execCmd("rm", "-rf", imageIndexDir);
    }
  }

  private getPathToBlob(ociBlobsDir: string, descriptor: OCIDescriptor): string {
    const [algo, digest] = descriptor.digest.split(":");
    return path.join(ociBlobsDir, algo, digest);
  }

  private async loadLocalOCIImage(
    outputId: string,
    ociIndexPath: string,
    ociBlobsDir: string,
  ): Promise<Image> {
    const index: OCIImageIndex = await readJsonFileOfType(ociIndexPath, OCIImageIndexValidator);
    // FIXME: Analyze every manifest or select the proper manifest based on platform :)
    if (index.manifests.length > 1) {
      throw new Error("Unsupported multi platform and multi format images");
    }
    const manifestDescriptor: OCIDescriptor = await index.manifests[0];
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
    // The data was already downloaded locally so this should be fairly quick
    for (const layerDescriptor of manifest.layers) {
      await this.loadLocalLayer(this.getPathToBlob(ociBlobsDir, layerDescriptor), layerDescriptor);
    }

    // Ok the blobs were loaded, time to write the image manifest :)
    if (
      !(await this.idempotentConfigWrite(
        JSON.stringify(manifest),
        path.join(this.paths.images, outputId),
      ))
    ) {
      throw new Error(`Image with id ${outputId} already exists`);
    }
    return outputId as Image;
  }

  private async loadLocalLayer(srcPath: string, layerDescriptor: OCIDescriptor) {
    // Path to the blob in the ingest
    const sharedOCIBlobPath = this.getPathToBlob(this.paths.sharedOCIBlobsDir, layerDescriptor);
    const dstDir = path.join(this.paths.layers, layerDescriptor.digest);
    await fs.mkdir(dstDir).catch(catchAlreadyExists);
    // This should be the root of the layer, hardlinks should point to that inode
    const dstPath = path.join(dstDir, "layer.tar");
    // Hardlink the blob from the src to the layers directory
    await fs.link(srcPath, dstPath).catch(async (err: Error) => {
      if (!err.message.startsWith("EEXIST")) throw err;
      await this.forceReplaceWithHardlink(dstPath, srcPath);
    });

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
  private async idempotentConfigWrite(content: string, dstPath: string): Promise<boolean> {
    await this.withTmpFile(async (tmpPath) => {
      await fs.writeFile(tmpPath, content);
      // Love that POSIX specifies link as an atomic filesystem operation
      // If multiple loads with the same ID occur at the same time only one of them will win the race
      await fs.link(tmpPath, dstPath).catch(async (err: Error) => {
        if (!err.message.startsWith("EEXIST")) throw err;
        // Check for idempotence
        if (content === (await fs.readFile(dstPath, "utf-8"))) {
          return true;
        }
        return false;
      });
    });
    return true;
  }

  private async withTmpFile<T>(fn: (tmpPath: string) => Promise<T>): Promise<T> {
    const tmpPath = path.join(this.paths.run, "tmp-" + this.genId());
    try {
      return await fn(tmpPath);
    } finally {
      await fs.unlink(tmpPath).catch(() => {
        void 0;
      });
    }
  }

  private async imageToOBDLowers(image?: Image): Promise<{ file: string }[]> {
    const lowers = [];
    if (image !== void 0) {
      const manifest: OCIImageManifest = await readJsonFileOfType(
        path.join(this.paths.images, image),
        OCIImageManifestValidator,
      );
      for (const layerDescriptor of manifest.layers) {
        lowers.push({
          file: path.join(this.paths.layers, layerDescriptor.digest, "layer.tar"),
        });
      }
    }
    return lowers;
  }

  public async createContainer(image?: Image, outputId?: string): Promise<Container> {
    outputId = this.genId(outputId);
    const lowers = await this.imageToOBDLowers(image);
    const dataPath = path.join(this.paths.containers, outputId, "data");
    const indexPath = path.join(this.paths.containers, outputId, "index");
    await fs.mkdir(path.join(this.paths.containers, outputId)).catch(catchAlreadyExists);
    await this.withTmpFile(async (tmpDataPath) => {
      await this.withTmpFile(async (tmpIndexPath) => {
        // TODO: Set the parent uuid, the only reason i did not do it right now is that i don't want to rewrite the algo for converting layer_digest -> obd_uuid
        // FIXME: For now hardcode the size to 64GB as the base images are hardcoded to this size
        await execCmd("/opt/overlaybd/bin/overlaybd-create", "-s", tmpDataPath, tmpIndexPath, "64");
        await fs.link(tmpDataPath, dataPath).catch(catchAlreadyExists);
        await fs.link(tmpIndexPath, indexPath).catch(catchAlreadyExists);
      });
    });
    const upper = { index: indexPath, data: dataPath };
    const resultFile = path.join(this.paths.run, "obd-result-" + outputId);

    if (
      !(await this.idempotentConfigWrite(
        JSON.stringify({ lowers, upper, resultFile, hocusImageId: image }),
        path.join(this.paths.containers, outputId, "obd-config"),
      ))
    ) {
      throw new Error(`Container with id ${outputId} already exists`);
    }

    return outputId as Container;
  }

  public async commitContainer(container: Container, outputId?: string): Promise<Image> {
    // TODO: ensure container exists and is currently not exposed
    outputId = this.genId(outputId);
    const obdConfig: OBDConfig = await readJsonFileOfType(
      path.join(this.paths.containers, container, "obd-config"),
      OBDConfigValidator,
    );
    // Sealing is not supported for sparse layers :P
    const commitPath = path.join(this.paths.containers, container, "overlaybd.commit");
    const layerPath = path.join(this.paths.containers, container, "layer.tar");
    await execCmd(
      "/opt/overlaybd/bin/overlaybd-commit",
      obdConfig.upper.data,
      obdConfig.upper.index,
      commitPath,
    );
    // For some reason the -t or seal option doesn't work in overlaybd-commit
    await execCmd(
      "tar",
      "-cf",
      layerPath,
      "-C",
      `${path.join(this.paths.containers, container)}`,
      "--sort=name",
      "--owner=hocus:0",
      "--group=hocus:0",
      "--mtime='1970-01-01 00:00'",
      "overlaybd.commit",
    );
    const layerDigest = `sha256:${
      (await execCmd("sha256sum", layerPath)).stdout.toString("utf8").split(" ")[0]
    }`;
    const layerSize = (await fs.stat(layerPath)).size;
    const image = obdConfig.hocusImageId as Image | undefined;
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

    await this.loadLocalLayer(layerPath, layerDescriptor);
    await fs.unlink(layerPath);
    await fs.unlink(commitPath);
    if (
      !(await this.idempotentConfigWrite(
        JSON.stringify(manifest),
        path.join(this.paths.images, outputId),
      ))
    ) {
      throw new Error(`Image with id ${outputId} already exists`);
    }
    await execCmd("rm", "-rf", path.join(this.paths.containers, container));
    return outputId as Image;
  }
}
