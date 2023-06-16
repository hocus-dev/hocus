import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import type { HttpsOpencontainersOrgSchemaDescriptor } from "./oci-schema/content-descriptor";
import { HttpsOpencontainersOrgSchemaImageIndex } from "./oci-schema/image-index-schema";
import { HttpsOpencontainersOrgSchemaImageManifest } from "./oci-schema/image-manifest-schema";

import { compileSchema } from "~/schema/utils.server";

export type OCIImageIndex = Any.Compute<Static<typeof HttpsOpencontainersOrgSchemaImageIndex>>;
export const OCIImageIndexValidator = compileSchema(HttpsOpencontainersOrgSchemaImageIndex);

export type OCIImageManifest = Any.Compute<
  Static<typeof HttpsOpencontainersOrgSchemaImageManifest>
>;
export const OCIImageManifestValidator = compileSchema(HttpsOpencontainersOrgSchemaImageManifest);

export type OCIDescriptor = Any.Compute<Static<typeof HttpsOpencontainersOrgSchemaDescriptor>>;

const OBDLowerSchema = Type.Union([
  // Local layer
  Type.Object({ hocusLayerType: Type.Literal("local"), file: Type.String() }),
  // Lazy pulled layer
  Type.Object({
    hocusLayerType: Type.Literal("lazy"),
    dir: Type.String(),
    digest: Type.String(),
    size: Type.Number(),
  }),
  // We don't support FAST OCI
]);
export type OBDLower = Any.Compute<Static<typeof OBDLowerSchema>>;

// Overlaybd ignores extra fields in the config so we may reuse it
// For reference see what overlaybd needs: https://github.com/containerd/overlaybd/blob/2c4d1e5ab3ed5aaa816f7057aae2da43d50f0b12/src/config.h#L57
// Hocus specific fields are prefixed with "hocus"
const OBDConfigSchema = Type.Object({
  // Where to find the blobs for lazy pulling
  repoBlobUrl: Type.Optional(Type.String()),
  // Lower layers config, use hocusLayerType to determine the type
  lowers: Type.Array(OBDLowerSchema),
  // Upper layer config, We don't support FAST OCI (no target and gzipIndex parameters)
  upper: Type.Optional(Type.Object({ data: Type.String(), index: Type.String() })),
  // Where OBD should write the result of creating a device
  resultFile: Type.String(),
  // Image download config
  download: Type.Optional(
    Type.Object({
      // Enable background download?
      enable: Type.Optional(Type.Boolean()),
      // When to start downloading after starting the device? Default: 5min
      delay: Type.Optional(Type.Number()),
      // Random extra delay, Default: 0.5 min
      delayExtra: Type.Optional(Type.Number()),
      // Download speed limit in MB/s, Default 100 MB/s
      maxMBps: Type.Optional(Type.Number()),
      // Number of retries if requests fail. Default: 5
      tryCnt: Type.Optional(Type.Number()),
      // Download chunk size. Default: 256 KB
      blockSize: Type.Optional(Type.Number()),
    }),
  ),
  // Is a acceleration layer present(prefetch trace)
  accelerationLayer: Type.Optional(Type.Boolean()),
  // Where to record a prefetch trace
  recordTracePath: Type.Optional(Type.String()),
  // Which hocus image id refers to this config?
  hocusImageId: Type.Optional(Type.String()),
  // Where were the original base layers were pulled from?
  hocusBaseRemoteRef: Type.Optional(Type.String()),
});

export type OBDConfig = Any.Compute<Static<typeof OBDConfigSchema>>;
export const OBDConfigValidator = compileSchema(OBDConfigSchema);
