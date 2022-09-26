import { Type as t } from "@sinclair/typebox";

export const OidcUserSchema = t.Object({
  sub: t.String(),
  email: t.String(),
});
