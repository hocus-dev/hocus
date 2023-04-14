import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { CreateSshKeySchema } from "~/schema/create-ssh-key.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type CreateSshKey = Any.Compute<Static<typeof CreateSshKeySchema>>;
export const CreateSshKeyValidator = compileSchema(CreateSshKeySchema);
