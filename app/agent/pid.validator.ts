import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { compileSchema } from "~/schema/utils.server";

import { PidSchema } from "./pid.schema";

export type Pid = Any.Compute<Static<typeof PidSchema>>;
export const PidValidator = compileSchema(PidSchema);
