import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import type { TaskId, TaskSchemas } from "./schemas.server";

import type { valueof } from "~/types/utils";

export type TaskPayload = {
  [key in TaskId]: Any.Compute<Static<typeof TaskSchemas[key]>>;
};

export type TaskParams = valueof<{
  [Id in TaskId]: { taskId: Id; payload: TaskPayload[Id] };
}>;
