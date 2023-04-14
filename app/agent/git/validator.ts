import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { RemoteInfoTupleSchema } from "./schema";

import { compileSchema } from "~/schema/utils.server";

export type RemoteInfoTuple = Any.Compute<Static<typeof RemoteInfoTupleSchema>>;
export const RemoteInfoTupleValidator = compileSchema(RemoteInfoTupleSchema);
