import type { LoaderArgs, ActionArgs } from "@remix-run/node";

import { json, useActionData, useLoaderData } from "~/remix-superjson";

export const loader = async ({ context: { db } }: LoaderArgs) => {
  const players = await db.player.findMany();
  return json({
    players,
  });
};

export const action = async (args: ActionArgs) => {
  const formData = Object.fromEntries(await args.request.formData());
  console.log(formData);
  return json({ xd: "3d" });
};

export default function Index() {
  const { players } = useLoaderData<typeof loader>();
  // const actionData = useActionData<typeof action>();

  return (
    <div>
      <form method="post" action="?index">
        <label htmlFor="fname">First name:</label>
        <br />
        <input type="text" id="fname" name="fname" value="John" readOnly></input>
        <br />
        <input type="submit" value="Submit"></input>
        <br />
      </form>
      <h1>Players</h1>
      {players.map(({ username }) => (
        <p key={username}>{username}</p>
      ))}
      {/* <p>actionData: {JSON.stringify(actionData)}</p> */}
    </div>
  );
}
