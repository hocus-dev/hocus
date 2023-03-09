import { Type as t } from "@sinclair/typebox";

export const NewWorkspaceSchema = t.Object({
  projectId: t.String({ minLength: 1, maxLength: 255 }),
});
