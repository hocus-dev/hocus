import type { TLiteral, TObject, TString, TUnion } from "@sinclair/typebox";
import { Type as t } from "@sinclair/typebox";
import { GAEventName, GAEventSchema, GAEventUserIdRequired } from "~/analytics/event.server";
import { mapenum } from "~/utils.shared";

import type { valueof } from "~/types/utils";

export type TaskId = valueof<typeof TaskId>;
export const TaskId = {
  SendGAEvent: "send-ga-event",
} as const;

const sendGAEventSchema: TUnion<
  valueof<{
    [Name in GAEventName]: TObject<
      {
        name: TLiteral<Name>;
        params: typeof GAEventSchema[Name];
      } & (typeof GAEventUserIdRequired[Name] extends true ? { userId: TString<string> } : {})
    >;
  }>[]
> = t.Union(
  Object.values(GAEventName).map((name) => {
    const schema = t.Object({
      name: t.Literal(name),
      params: GAEventSchema[name],
    }) as any;
    if (GAEventUserIdRequired[name]) {
      schema.userId = t.String();
    }
    return schema;
  }),
);

export const TaskSchemas = mapenum<TaskId>()({
  [TaskId.SendGAEvent]: sendGAEventSchema,
} as const);
