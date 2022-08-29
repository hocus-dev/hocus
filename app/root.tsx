import type { MetaFunction, LinksFunction } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";

import styles from "./styles/app.css";

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "New Remix App",
  viewport: "width=device-width,initial-scale=1",
});

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

export default function App() {
  return (
    <html className="dark h-full" lang="en">
      <head>
        <Meta />
        <Links />
        <link rel="stylesheet" href="/devicon.min.css" />
      </head>
      <body className="h-full dark:bg-gray-800">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
