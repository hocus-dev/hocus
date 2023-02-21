import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { CreateWorkspaceFormSchema } from "~/schema/create-workspace-form.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type CreateWorkspaceForm = Any.Compute<Static<typeof CreateWorkspaceFormSchema>>;
export const CreateWorkspaceFormValidator = compileSchema(CreateWorkspaceFormSchema);
