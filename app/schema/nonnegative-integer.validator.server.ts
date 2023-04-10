import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { NonnegativeIntegerSchema } from "~/schema/nonnegative-integer.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type NonnegativeInteger = Any.Compute<Static<typeof NonnegativeIntegerSchema>>;
export const NonnegativeIntegerValidator = compileSchema(NonnegativeIntegerSchema);
