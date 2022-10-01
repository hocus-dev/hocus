import type { Static } from "@sinclair/typebox";
import { Type as t } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { mapenum } from "~/utils.shared";

import type { valueof } from "~/types/utils";

export type GAEventName = valueof<typeof GAEventName>;
export const GAEventName = {
  SignUp: "sign_up",
} as const;

export type GAEventUserIdRequired = valueof<typeof GAEventName>;
export const GAEventUserIdRequired = mapenum<GAEventName>()({
  [GAEventName.SignUp]: true,
} as const);

export const GAEventSchema = mapenum<GAEventName>()({
  [GAEventName.SignUp]: t.Object({ method: t.String() }),
} as const);

export type GAEventPayload = {
  [key in GAEventName]: Any.Compute<Static<typeof GAEventSchema[key]>>;
};

/**
 * Enfore that all values of GAEventUserIdRequired are booleans
 */
const _typeCheck: typeof GAEventUserIdRequired extends Record<GAEventName, boolean> ? 1 : 0 = 1;
