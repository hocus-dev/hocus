import { Type as t } from "@sinclair/typebox";

export const RemoteInfoTupleSchema = t.Tuple([
  t.String({ minLength: 1 }),
  t.String({ minLength: 1 }),
]);
