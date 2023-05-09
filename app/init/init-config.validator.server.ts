import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { InitConfigSchema } from "./init-config.schema.server";

import { compileSchema } from "~/schema/utils.server";

export type InitConfig = Any.Compute<Static<typeof InitConfigSchema>>;
export const InitConfigValidator = compileSchema(InitConfigSchema);
