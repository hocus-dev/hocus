import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import {
  DEFAULT_REDIRECT_TO,
  REDIRECT_QUERY_PARAM_NAME,
  REDIRECT_TO_COOKIE_NAME,
} from "./login-redirect.constant";
import { OauthSchema } from "./oauth.schema";

export const loader = async (args: LoaderArgs) => {
  const query = OauthSchema.parse(args.context.req.query);
  const redirectToAfterLogin = query[REDIRECT_QUERY_PARAM_NAME] ?? DEFAULT_REDIRECT_TO;
  if (args.context.user != null) {
    return redirect(redirectToAfterLogin);
  }

  const authService = args.context.app.resolve("AuthService");
  const url = authService.getUrlForOauthProvider(query.provider);
  args.context.res.cookie(REDIRECT_TO_COOKIE_NAME, redirectToAfterLogin, {
    httpOnly: true,
  });
  return redirect(url);
};
