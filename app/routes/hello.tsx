import type { LoaderArgs } from "@remix-run/node";
import { json, useLoaderData } from "~/remix-superjson.server";

export const loader = async ({ context: { user } }: LoaderArgs) => {
  return json({
    email: user?.email,
  });
};

export default function Hello() {
  const { email } = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Hello {email ?? "user"}!</h1>
    </div>
  );
}
