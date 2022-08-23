import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { REDIRECT_QUERY_PARAM_NAME, REDIRECT_TO_COOKIE_NAME } from "./login-redirect.constant";
import { OauthSchema } from "./oauth.schema";

export const loader = async (args: LoaderArgs) => {
  const query = OauthSchema.parse(args.context.req.query);
  const authService = args.context.app.resolve("AuthService");
  const url = authService.getUrlForOauthProvider(query.provider);
  if (query[REDIRECT_QUERY_PARAM_NAME] != null) {
    args.context.res.cookie(REDIRECT_TO_COOKIE_NAME, query[REDIRECT_QUERY_PARAM_NAME], {
      httpOnly: true,
    });
  }
  return redirect(url);
};
