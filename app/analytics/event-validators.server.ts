import type { Validator } from "~/schema/utils.server";
import { compileSchema } from "~/schema/utils.server";

import type { GAEventName } from "./event.server";
import { GAEventSchema } from "./event.server";

export const TaskValidators: {
  [key in GAEventName]: Validator<typeof GAEventSchema[key]>;
} = Object.entries(GAEventSchema).reduce((acc, [key, schema]) => {
  acc[key] = compileSchema(schema);
  return acc;
}, {} as any);
