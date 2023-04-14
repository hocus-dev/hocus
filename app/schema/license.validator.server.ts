import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { LicenseSchema } from "~/schema/license.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type License = Any.Compute<Static<typeof LicenseSchema>>;
export const LicenseValidator = compileSchema(LicenseSchema);
