import { Type as t } from "@sinclair/typebox";

export const InjectSchema = t.Union([t.Array(t.String()), t.Undefined()]);
