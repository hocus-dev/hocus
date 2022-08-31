import { z } from "zod";

import { REDIRECT_QUERY_PARAM_NAME } from "./login-redirect.constant";

export const SignInIndexSchema = z.object({
  [REDIRECT_QUERY_PARAM_NAME]: z.string().optional(),
});
