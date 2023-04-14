import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { compileSchema } from "~/schema/utils.server";
import { UuidSchema } from "~/schema/uuid.schema.server";

export type Uuid = Any.Compute<Static<typeof UuidSchema>>;
export const UuidValidator = compileSchema(UuidSchema);
