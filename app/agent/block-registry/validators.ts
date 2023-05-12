import type { Static } from "@sinclair/typebox";
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
