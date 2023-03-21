import { Type as t } from "@sinclair/typebox";

export const UpdateGitDetailsSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 500 }),
  email: t.String({ format: "email" }),
});
