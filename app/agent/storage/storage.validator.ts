import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { AgentStorageSchema } from "./storage.schema";

import { compileSchema } from "~/schema/utils.server";

export type AgentStorage = Any.Compute<Static<typeof AgentStorageSchema>>;
export const AgentStorageValidator = compileSchema(AgentStorageSchema);
