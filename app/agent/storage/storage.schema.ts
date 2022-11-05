import { Type as t } from "@sinclair/typebox";

export const AgentStorageSchema = t.Object({
  busyIpIds: t.Array(t.Number({ minimum: 3, maximum: 65534 })),
});
