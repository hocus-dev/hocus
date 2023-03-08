import { Type as t } from "@sinclair/typebox";

export const CreateSshKeySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  publicKey: t.String({ minLength: 1, maxLength: 20000 }),
});
