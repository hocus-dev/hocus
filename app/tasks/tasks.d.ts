import type { valueof } from "~/types/utils";

export type TaskPayload = {
  "send-ga-event": {
    category: string;
  };
};

export type TaskParams = valueof<{
  [Id in keyof TaskPayload]: { id: Id; payload: TaskPayload[Id] };
}>;
