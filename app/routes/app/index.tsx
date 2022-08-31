import type { LoaderArgs } from "@remix-run/node";
import { Button } from "flowbite-react";
import { json, useLoaderData } from "~/remix-superjson";

import { LOGOUT_URL } from "./sign-in/login-redirect.constant";

export const loader = async (args: LoaderArgs) => {
  return json({ user: args.context.user });
};

export default function AppIndex(): JSX.Element {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div>
      <p>{user == null ? "You are not logged in." : `Hello ${user.email}!`}</p>
      <form action={LOGOUT_URL} method="GET">
        <Button outline={true} type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
