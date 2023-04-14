import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { PrebuildLogsSchema } from "~/schema/prebuild-logs.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type PrebuildLogs = Any.Compute<Static<typeof PrebuildLogsSchema>>;
export const PrebuildLogsValidator = compileSchema(PrebuildLogsSchema);
