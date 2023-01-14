import { Type as t } from "@sinclair/typebox";

import { MAXIMUM_IP_ID, MINIMUM_IP_ID } from "./constants";

export const AgentStorageSchema = t.Object({
  agentId: t.String({ minLength: 1 }),
  busyIpBlockIds: t.Array(t.Number({ minimum: MINIMUM_IP_ID, maximum: MAXIMUM_IP_ID }), {
    uniqueItems: true,
  }),
});
