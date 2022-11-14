import { Type as t } from "@sinclair/typebox";

export const PidSchema = t.String({ pattern: "\\s*\\d+\\s*" });
