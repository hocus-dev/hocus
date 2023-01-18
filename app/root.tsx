/* eslint-disable filename-rules/match */
import type { MetaFunction, LinksFunction, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";

import { GlobalContext } from "./components/global-context.shared";
import styles from "./styles/app.css";

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Hocus",
  viewport: "width=device-width,initial-scale=1",
});

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: "/devicon.min.css" },
    { rel: "stylesheet", href: "/font-awesome/css/all.min.css" },
    { rel: "stylesheet", href: styles },
    /* Must be the last entry to prevent a flash of unstyled content. Based on https://stackoverflow.com/a/43823506 */
    { rel: "stylesheet", href: "/unstyled-content.css" },
  ];
};

export const loader = async (args: LoaderArgs) => {
  return json({
    csrfToken: args.context.req.csrfToken(),
    gaUserId: args.context.user?.gaUserId,
    userEmail: args.context.oidcUser?.email,
  });
};

export default function App() {
  const { gaUserId, csrfToken, userEmail } = useLoaderData<typeof loader>();

  return (
    <GlobalContext.Provider value={{ gaUserId, csrfToken, userEmail }}>
      <html className="dark h-full" lang="en">
        <head>
          {/* Prevents a flash of unstyled content. Based on https://stackoverflow.com/a/43823506 */}
          <style>{"html { display: none; }"}</style>
          <Meta />
          <Links />
        </head>
        <body className="h-full flex flex-col dark:bg-gray-800 dark:text-white">
          <Outlet />
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
        </body>
      </html>
    </GlobalContext.Provider>
  );
}
