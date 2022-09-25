import type { LoaderArgs } from "@remix-run/node";
import { Button } from "flowbite-react";
import { json, useLoaderData } from "~/remix-superjson.server";
import { unwrap } from "~/utils.shared";

export const loader = async (args: LoaderArgs) => {
  return json({ user: unwrap(args.context.req.oidc.user) });
};

export default function AppIndex(): JSX.Element {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div>
      <p>{`Hello ${user.email}!`}</p>
      <p>{`Hello ${JSON.stringify(user)}!`}</p>
      <form action="/app/logout" method="GET">
        <Button outline={true} type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
