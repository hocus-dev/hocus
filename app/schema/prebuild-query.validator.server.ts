import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { PrebuildQuerySchema } from "~/schema/prebuild-query.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type PrebuildQuery = Any.Compute<Static<typeof PrebuildQuerySchema>>;
export const PrebuildQueryValidator = compileSchema(PrebuildQuerySchema);
