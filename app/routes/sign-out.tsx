import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({ context }: LoaderArgs) => {
  const logger = context.app.resolve("Logger");
  const authService = context.app.resolve("AuthService");
  if (context.user != null) {
    await authService.signOut(context.req, context.res);
  } else {
    logger.warn("No user found in context during sign out");
  }
  return redirect("/");
};
