import { z } from "zod";

import {
  GOOGLE_PROVIDER_ID,
  PROVIDER_PARAM_NAME,
  REDIRECT_QUERY_PARAM_NAME,
} from "./login-redirect.constant";

export const OauthSchema = z.object({
  [PROVIDER_PARAM_NAME]: z.enum([GOOGLE_PROVIDER_ID] as const),
  [REDIRECT_QUERY_PARAM_NAME]: z.string().optional(),
});
