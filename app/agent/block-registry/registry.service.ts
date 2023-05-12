import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

import type { Static, TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { type DefaultLogger } from "@temporalio/worker";
import type { Any } from "ts-toolbelt";
import { F } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

import { execCmd } from "../utils";

import type { OCIDescriptor, OCIImageIndex, OCIImageManifest } from "./validators";
import { OCIImageIndexValidator, OCIImageManifestValidator } from "./validators";

import { type Config } from "~/config";
import type { Validator } from "~/schema/utils.server";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

const BlobTransferMethod = {
  BLOB_TRANSFER_METHOD_HARDLINK: "BLOB_TRANSFER_METHOD_HARDLINK",
  BLOB_TRANSFER_METHOD_MOVE: "BLOB_TRANSFER_METHOD_MOVE",
} as const;
type BlobTransferMethod = (typeof BlobTransferMethod)[keyof typeof BlobTransferMethod];

export interface Image {
  id: string;
}

export interface Container {
  id: string;
}

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
    ingestImages: string;
    ingestBlobs: string;
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
      ingestImages: path.join(root, "ingest/images"),
      ingestBlobs: path.join(root, "ingest/blobs"),
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
    // First ensure the directory structure is ok and generate the TCMU subtype which will handle the registry
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

    // We are after an restart - we need to check the block devices
  }

  async loadImageFromDisk(ociDumpPath: string, outputId?: string): Promise<Image> {
    return await this.loadLocalOCIImage(
      this.genId(outputId),
      `${path.join(ociDumpPath, "index.json")}`,
      `${path.join(ociDumpPath, "blobs")}`,
      BlobTransferMethod.BLOB_TRANSFER_METHOD_MOVE,
    );
  }

  // Mostly for convenience :)
  async loadImageFromRemoteRepo(ref: string, outputId?: string): Promise<Image> {
    outputId = this.genId(outputId);
    // Get the image from the remote repo
    // This will only download blobs we actually need due to the shared blob dir <3
    // Also skopeo properly handles concurrent pulls with a shared blob dir <3
    execCmd(
      "skopeo",
      "copy",
      "--dest-oci-accept-uncompressed-layers",
      "--dest-shared-blob-dir",
      this.paths.ingestBlobs,
      `docker://${ref}`,
      `oci:${path.join(this.paths.ingestImages, outputId)}`,
    );

    return await this.loadLocalOCIImage(
      outputId,
      `${path.join(this.paths.ingestImages, outputId, "index.json")}`,
      this.paths.ingestBlobs,
      BlobTransferMethod.BLOB_TRANSFER_METHOD_HARDLINK,
    );
  }

  private getPathToBlob(blobsDir: string, descriptor: OCIDescriptor): string {
    const [algo, digest] = descriptor.digest.split(":");
    return path.join(blobsDir, algo, digest);
  }

  private async loadLocalOCIImage(
    outputId: string,
    indexPath: string,
    blobsDir: string,
    blobTransferMethod: BlobTransferMethod,
  ): Promise<Image> {
    const index: OCIImageIndex = await readJsonFileOfType(indexPath, OCIImageIndexValidator);
    // FIXME: Analyze every manifest or select the proper manifest based on platform :)
    if (index.manifests.length > 1) {
      throw new Error("Unsupported multi platform and multi format images");
    }
    console.log(index);
    console.log(
      JSON.parse(await fs.readFile(this.getPathToBlob(blobsDir, index.manifests[0]), "utf-8")),
    );
    const manifestDescriptor: OCIDescriptor = await index.manifests[0];
    const manifest: OCIImageManifest = await readJsonFileOfType(
      this.getPathToBlob(blobsDir, manifestDescriptor),
      OCIImageManifestValidator,
    );

    // Now check if that image is in overlaybd format, no fastoci support cause it's slow
    // Also we would need to pull another image for that
    for (const layerDescriptor of manifest.layers) {
      if (
        layerDescriptor.mediaType !== "application/vnd.oci.image.layer.v1.tar+gzip" ||
        // Assume that layers without annotations are definitely not from obd
        layerDescriptor.annotations === void 0 ||
        // This annotation is present with obd layers
        (layerDescriptor.annotations as any)["containerd.io/snapshot/overlaybd/blob-digest"] ===
          void 0
      ) {
        throw new Error(`Unsupported layer ${JSON.stringify(layerDescriptor)}`);
      }
    }

    console.log(manifest);
  }
}
