import type { Static } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";
import { OidcUserSchema } from "~/schema/oidc-user.schema.server";
import { compileSchema } from "~/schema/utils.server";

export type OidcUser = Any.Compute<Static<typeof OidcUserSchema>>;
export const OidcUserValidator = compileSchema(OidcUserSchema);
