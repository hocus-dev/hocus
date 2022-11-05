import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { compileSchema } from "~/schema/utils.server";

import { AgentStorageSchema } from "./storage.schema";

export type AgentStorage = Any.Compute<Static<typeof AgentStorageSchema>>;
export const AgentStorageValidator = compileSchema(AgentStorageSchema);
