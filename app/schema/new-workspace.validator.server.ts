import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { NewWorkspaceSchema } from "~/schema/new-workspace.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type NewWorkspace = Any.Compute<Static<typeof NewWorkspaceSchema>>;
export const NewWorkspaceValidator = compileSchema(NewWorkspaceSchema);
