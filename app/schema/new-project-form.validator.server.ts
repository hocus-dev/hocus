import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { NewProjectFormSchema } from "~/schema/new-project-form.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type NewProjectForm = Any.Compute<Static<typeof NewProjectFormSchema>>;
export const NewProjectFormValidator = compileSchema(NewProjectFormSchema);
