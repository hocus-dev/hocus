import { Type as t } from "@sinclair/typebox";

import { UuidSchema } from "./uuid.schema.server";

export const NewWorkspaceSchema = t.Union([
  t.Object({
    projectId: UuidSchema,
    prebuildId: t.Optional(t.Undefined()),
  }),
  t.Object({
    projectId: t.Optional(t.Undefined()),
    prebuildId: UuidSchema,
  }),
]);
