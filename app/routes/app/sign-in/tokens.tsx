import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { DEFAULT_REDIRECT_TO, REDIRECT_TO_COOKIE_NAME } from "./login-redirect.constant";

export const loader = async (args: LoaderArgs) => {
  const authService = args.context.app.resolve("AuthService");
  const response = await authService.authorize(args.context.req, args.context.res);
  if (response.user == null) {
    throw response.error;
  }
  const url = args.context.req.cookies[REDIRECT_TO_COOKIE_NAME] ?? DEFAULT_REDIRECT_TO;
  args.context.res.clearCookie(REDIRECT_TO_COOKIE_NAME);
  return redirect(url);
};
