import { Type as t } from "@sinclair/typebox";

export const PrebuildQuerySchema = t.Object({
  task: t.Union([t.String(), t.Undefined()]),
});
