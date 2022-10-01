import { Type as t } from "@sinclair/typebox";
import { GAEventName, GAEventSchema } from "~/analytics/event.server";
import { mapenum } from "~/utils.shared";

import type { valueof } from "~/types/utils";

export type TaskId = valueof<typeof TaskId>;
export const TaskId = {
  SendGAEvent: "send-ga-event",
} as const;

export const TaskSchemas = mapenum<TaskId>()({
  [TaskId.SendGAEvent]: t.Object({
    name: t.Literal(GAEventName.SignUp),
    userId: t.String(),
    params: GAEventSchema[GAEventName.SignUp],
  }),
} as const);
