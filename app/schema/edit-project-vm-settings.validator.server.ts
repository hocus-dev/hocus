import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { EditProjectVmSettingsSchema } from "~/schema/edit-project-vm-settings.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type EditProjectVmSettings = Any.Compute<Static<typeof EditProjectVmSettingsSchema>>;
export const EditProjectVmSettingsValidator = compileSchema(EditProjectVmSettingsSchema);
