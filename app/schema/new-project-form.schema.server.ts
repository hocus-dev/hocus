import { Type as t } from "@sinclair/typebox";

export const NewProjectFormSchema = t.Object({
  projectName: t.String({ minLength: 1, maxLength: 255 }),
  repositoryUrl: t.String({ maxLength: 2000 }),
  workspaceRootPath: t.Optional(t.String({ maxLength: 2000 })),
});
