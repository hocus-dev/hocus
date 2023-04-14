import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { PidSchema } from "./pid.schema";

import { compileSchema } from "~/schema/utils.server";

export type Pid = Any.Compute<Static<typeof PidSchema>>;
export const PidValidator = compileSchema(PidSchema);
