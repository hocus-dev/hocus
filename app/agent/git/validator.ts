import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { compileSchema } from "~/schema/utils.server";

import { RemoteInfoTupleSchema } from "./schema";

export type RemoteInfoTuple = Any.Compute<Static<typeof RemoteInfoTupleSchema>>;
export const RemoteInfoTupleValidator = compileSchema(RemoteInfoTupleSchema);
