import { Type as t } from "@sinclair/typebox";

export const NonnegativeIntegerSchema = t.String({ pattern: "^([1-9]\\d*|0)$" });
