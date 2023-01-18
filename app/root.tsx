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
    { rel: "stylesheet", href: styles },
    { rel: "stylesheet", href: "/font-awesome/css/all.min.css" },
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
          <Meta />
          <Links />
          <link rel="stylesheet" href="/devicon.min.css" />
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
