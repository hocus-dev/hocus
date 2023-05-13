import { Static, Type } from "@sinclair/typebox";
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

const OBDConfigSchema = Type.Object({
  lowers: Type.Array(Type.Object({ file: Type.String() })),
  upper: Type.Object({ data: Type.String(), index: Type.String() }),
  resultFile: Type.String(),
  // OBD doesn't complain about this extra field :)
  hocusImageId: Type.Optional(Type.String()),
});

export type OBDConfig = Any.Compute<Static<typeof OBDConfigSchema>>;
export const OBDConfigValidator = compileSchema(OBDConfigSchema);
