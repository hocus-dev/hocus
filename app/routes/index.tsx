import type { LoaderArgs, ActionArgs } from "@remix-run/node";
import { json, useActionData, useLoaderData } from "~/remix-superjson";
import { ActionFormSchema } from "~/schema/index.schema";

export const loader = async ({ context: { db, user } }: LoaderArgs) => {
  const players = await db.player.findMany();
  return json({
    players,
    userEmail: user?.email,
  });
};

export const action = async (args: ActionArgs) => {
  const db = args.context.db;
  const formData = Object.fromEntries(await args.request.formData());
  const checkedFormData = ActionFormSchema.parse(formData);
  const fname = checkedFormData.fname;
  const newPlayer = await db.player.create({ data: { username: fname } });
  return json({ player: newPlayer.username });
};

export default function Index() {
  const { players, userEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <h1>Your email is {userEmail ?? "undefined"}</h1>
      <form method="post" action="?index">
        <label htmlFor="fname">First name:</label>
        <br />
        <input type="text" id="fname" name="fname" placeholder="John"></input>
        <br />
        <input type="submit" value="Submit"></input>
        <br />
      </form>
      <h1>Players</h1>
      {actionData && <p>New player created: {actionData.player}</p>}
      {players.map(({ username }) => (
        <p key={username}>{username}</p>
      ))}
    </div>
  );
}
