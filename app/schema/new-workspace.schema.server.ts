import { Type as t } from "@sinclair/typebox";

import { UuidSchema } from "./uuid.schema.server";

export const NewWorkspaceSchema = t.Object({
  projectId: UuidSchema,
});
