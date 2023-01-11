import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { compileSchema } from "~/schema/utils.server";

import { VmInfoSchema } from "./vm-info.schema";

export type VmInfo = Any.Compute<Static<typeof VmInfoSchema>>;
export const VmInfoValidator = compileSchema(VmInfoSchema);
