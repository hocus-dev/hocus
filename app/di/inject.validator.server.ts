import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { InjectSchema } from "./inject.schema.server";

import { compileSchema } from "~/schema/utils.server";

export type Inject = Any.Compute<Static<typeof InjectSchema>>;
export const InjectValidator = compileSchema(InjectSchema);
