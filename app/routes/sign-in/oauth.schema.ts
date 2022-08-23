import { z } from "zod";

import { REDIRECT_QUERY_PARAM_NAME } from "./login-redirect.constant";

export const OauthSchema = z.object({
  provider: z.enum(["google"] as const),
  [REDIRECT_QUERY_PARAM_NAME]: z.string().optional(),
});
