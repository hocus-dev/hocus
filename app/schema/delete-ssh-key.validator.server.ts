import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { DeleteSshKeySchema } from "~/schema/delete-ssh-key.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type DeleteSshKey = Any.Compute<Static<typeof DeleteSshKeySchema>>;
export const DeleteSshKeyValidator = compileSchema(DeleteSshKeySchema);
