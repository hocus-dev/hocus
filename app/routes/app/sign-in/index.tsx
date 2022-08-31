import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Button } from "flowbite-react";
import { json, useLoaderData } from "~/remix-superjson";

import { SignInIndexSchema } from "./index.schema";
import {
  DEFAULT_REDIRECT_TO,
  GOOGLE_PROVIDER_ID,
  PROVIDER_PARAM_NAME,
  REDIRECT_QUERY_PARAM_NAME,
} from "./login-redirect.constant";

export const loader = async (args: LoaderArgs) => {
  const query = SignInIndexSchema.parse(args.context.req.query);
  const redirectToAfterLogin = query[REDIRECT_QUERY_PARAM_NAME] ?? DEFAULT_REDIRECT_TO;
  if (args.context.user != null) {
    return redirect(redirectToAfterLogin);
  }
  return json({ redirectToAfterLogin });
};

export default function AppIndex(): JSX.Element {
  const { redirectToAfterLogin } = useLoaderData<typeof loader>();
  const href = `/app/sign-in/oauth?${PROVIDER_PARAM_NAME}=${GOOGLE_PROVIDER_ID}&${REDIRECT_QUERY_PARAM_NAME}=${redirectToAfterLogin}`;

  return (
    <div className="flex flex-col justify-center w-full h-full">
      <div className="flex justify-center">
        <div>
          <div className="w-100 flex justify-center mb-2">
            <img src="/logo-leaf.png" className="h-8" alt="Hocus Logo" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-16">Hocus</h1>
          {/* The rel="noreferrer" is crucial. When gotrue sees a referrer it ignores */}
          {/* the redirect url it should redirect to after /callback, and redirects to */}
          {/* http://localhost:3000/. I've just spent 3 hours debugging this. */}
          <a rel="noreferrer" href={href}>
            <Button size="lg" outline={true} type="submit">
              <i className="devicon-google-plain mr-4"></i>Continue with Google
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
