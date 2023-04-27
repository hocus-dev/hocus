import { Type as t } from "@sinclair/typebox";

import { UuidSchema } from "./uuid.schema.server";

export const SchedulePrebuildSchema = t.Object({
  projectExternalId: UuidSchema,
  gitObjectHash: t.String({ minLength: 1 }),
});
