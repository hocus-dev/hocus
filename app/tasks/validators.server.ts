import type { Validator } from "~/schema/utils.server";
import { compileSchema } from "~/schema/utils.server";

import { TaskSchemas } from "./schemas.server";
import type { TaskId } from "./schemas.server";

export const TaskValidators: {
  [key in TaskId]: Validator<typeof TaskSchemas[key]>;
} = Object.entries(TaskSchemas).reduce((acc, [key, schema]) => {
  acc[key] = compileSchema(schema);
  return acc;
}, {} as any);
