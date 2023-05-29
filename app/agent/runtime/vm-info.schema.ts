import { Type as t } from "@sinclair/typebox";

export const VmInfoSchema = t.Object({
  pid: t.Integer({ minimum: 0 }),
  instanceId: t.String({ minLength: 1 }),
  ipBlockId: t.Integer({ minimum: 0 }),
});
