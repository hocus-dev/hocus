import type { LoaderArgs, ActionArgs } from "@remix-run/node";
import CsrfInput from "~/components/csrf-input";
import { json, useActionData, useLoaderData } from "~/remix-superjson";
import { ActionFormSchema } from "~/schema/index.schema";

export const loader = async ({ context: { db, user, req } }: LoaderArgs) => {
  const players = await db.player.findMany();
  return json({
    players,
    userEmail: user?.email,
    csrfToken: req.csrfToken(),
  });
};

export const action = async (args: ActionArgs) => {
  const db = args.context.db;
  const formData = args.context.req.body;
  const checkedFormData = ActionFormSchema.parse(formData);
  const fname = checkedFormData.fname;
  const newPlayer = await db.player.create({ data: { username: fname } });
  return json({ player: newPlayer.username });
};

export default function Index() {
  const { players, userEmail, csrfToken } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <h1>Your email is {userEmail ?? "undefined"}</h1>
      <form method="post" action="?index">
        <CsrfInput token={csrfToken} />
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
