import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { ArchivePrebuildSchema } from "~/schema/archive-prebuild.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type ArchivePrebuild = Any.Compute<Static<typeof ArchivePrebuildSchema>>;
export const ArchivePrebuildValidator = compileSchema(ArchivePrebuildSchema);
