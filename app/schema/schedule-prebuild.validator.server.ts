import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { SchedulePrebuildSchema } from "~/schema/schedule-prebuild.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type SchedulePrebuild = Any.Compute<Static<typeof SchedulePrebuildSchema>>;
export const SchedulePrebuildValidator = compileSchema(SchedulePrebuildSchema);
