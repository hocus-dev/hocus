import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { UpdateGitDetailsSchema } from "~/schema/update-git-details.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type UpdateGitDetails = Any.Compute<Static<typeof UpdateGitDetailsSchema>>;
export const UpdateGitDetailsValidator = compileSchema(UpdateGitDetailsSchema);
