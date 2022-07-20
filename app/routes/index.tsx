import { json, useActionData, useLoaderData } from "~/remix-superjson";
import type { LoaderArgs, ActionArgs } from "@remix-run/node";

export const loader = async (_args: LoaderArgs) => {
  return json({
    names: ["Hugo", "Bruno", "Teodor", "Kajetan"],
    ids: [BigInt(1), BigInt(2), BigInt(3)],
    dates: [new Date()],
  });
};

export const action = async (args: ActionArgs) => {
  const formData = Object.fromEntries(await args.request.formData());
  console.log(formData);
  return json({ xd: "3d" });
};

export default function Index() {
  const { names, ids, dates } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

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
      <h1>Hey everyone!</h1>
      {names.map((name) => (
        <p key={name}>{name}</p>
      ))}
      {ids.map((id) => (
        <p key={id.toString()}>{typeof id}</p>
      ))}
      {dates.map((d) => (
        <p key={d.toString()}>{d.getFullYear()}</p>
      ))}
      <p>actionData: {JSON.stringify(actionData)}</p>
    </div>
  );
}
