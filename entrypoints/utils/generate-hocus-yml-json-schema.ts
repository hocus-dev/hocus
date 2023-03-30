import { Type as t } from "@sinclair/typebox";
import { ProjectConfigSchema } from "~/agent/project-config/schema";

const jsonSchema = JSON.stringify(t.Strict(ProjectConfigSchema), null, 2);

// eslint-disable-next-line no-console
console.log(jsonSchema);
