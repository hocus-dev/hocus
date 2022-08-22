import type { LoaderArgs } from "@remix-run/node";
import { json, useLoaderData } from "~/remix-superjson";

export const loader = async (args: LoaderArgs) => {
  const authService = args.context.app.resolve("AuthService");
  const response = await authService.authorize(args.context.req, args.context.res);
  if (response.user == null) {
    throw response.error;
  }
  return json({ user: response.user });
};

export default function Token() {
  const { user } = useLoaderData<typeof loader>();
  return <div>Email: {user.email}</div>;
}
