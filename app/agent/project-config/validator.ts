import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { compileSchema } from "~/schema/utils.server";

import { TaskSchema, ProjectConfigSchema } from "./schema";

export type Task = Any.Compute<Static<typeof TaskSchema>>;
export const TaskValidator = compileSchema(TaskSchema);

export type ProjectConfig = Any.Compute<Static<typeof ProjectConfigSchema>>;
export const ProjectConfigValidator = compileSchema(ProjectConfigSchema);
