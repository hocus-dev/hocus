import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { VmInfoSchema } from "./vm-info.schema";

import { compileSchema } from "~/schema/utils.server";

export type VmInfo = Any.Compute<Static<typeof VmInfoSchema>>;
export const VmInfoValidator = compileSchema(VmInfoSchema);
