import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { CancelPrebuildSchema } from "~/schema/cancel-prebuild.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type CancelPrebuild = Any.Compute<Static<typeof CancelPrebuildSchema>>;
export const CancelPrebuildValidator = compileSchema(CancelPrebuildSchema);
