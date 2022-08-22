import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { ParamsProviderSchema } from "~/schema/routes/sign-in/oauth.schema";

export const loader = async (args: LoaderArgs) => {
  const provider = ParamsProviderSchema.parse(args.context.req.query.provider);
  const authService = args.context.app.resolve("AuthService");
  const url = authService.getUrlForOauthProvider(provider);
  return redirect(url);
};
