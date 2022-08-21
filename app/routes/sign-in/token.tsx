import type { LoaderArgs } from "@remix-run/node";
import { GoTrueApi } from "@supabase/gotrue-js";

import { json, useLoaderData } from "~/remix-superjson";

export const loader = async (args: LoaderArgs) => {
  const api = new GoTrueApi({ url: "http://localhost:9999" });
  // TODO: add a secret so the JWT is verified
  const response = await api.getUserByCookie(args.context.req);
  if (response.user == null) {
    throw new Error("No user");
  }
  return json({ user: response.user });
};

export default function Token() {
  const { user } = useLoaderData<typeof loader>();
  return <div>Email: {user.email}</div>;
}
