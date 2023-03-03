import { Type as t } from "@sinclair/typebox";

import { UuidSchema } from "./uuid.schema.server";

export const PrebuildLogsSchema = t.Object({
  prebuildExternalId: UuidSchema,
  taskExternalId: UuidSchema,
});
