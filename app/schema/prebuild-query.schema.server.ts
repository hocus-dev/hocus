import { Type as t } from "@sinclair/typebox";

export const PrebuildQuerySchema = t.Object({
  task: t.Optional(t.String()),
});
