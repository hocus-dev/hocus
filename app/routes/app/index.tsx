import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Button } from "flowbite-react";

export const loader = async (args: LoaderArgs) => {
  return json({ gaUserId: args.context.user.gaUserId });
};

export default function AppIndex(): JSX.Element {
  const { gaUserId } = useLoaderData<typeof loader>();
  return (
    <div>
      <p>{`Hello ${gaUserId}!`}</p>
      <form action="/app/logout" method="GET">
        <Button outline={true} type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
