// eslint-disable-next-line no-restricted-imports
import type { PrismaClient, User } from "@prisma/client";
import "@remix-run/node";
import type { DataFunctionArgs } from "@remix-run/node";
import type { Request, Response } from "express";
import type { OidcUser } from "~/schema/oidc-user.schema.server";
import type { AppInjector } from "~/services/app-injector.server";

type Context = {
  db: PrismaClient;
  app: AppInjector;
  req: Request;
  res: Response;
  /**
   * The type is actually a lie - it's in fact User | null.
   * However the null case only happens when the user is not logged in
   * which only happens for routes outside of the /app scope.
   * I chose to make this non-nullable for convenience.
   * */
  user: User;
  /**
   * The type is actually a lie - it's in fact OidcUser | null.
   * However the null case only happens when the user is not logged in
   * which only happens for routes outside of the /app scope.
   * I chose to make this non-nullable for convenience.
   * */
  oidcUser: OidcUser;
};

// we omit these fields because they act weirdly with express
// if accessed
type Args = Omit<DataFunctionArgs, "request" | "params">;

declare module "@remix-run/node" {
  export interface LoaderArgs extends Args {
    context: Context;
  }

  export interface ActionArgs extends Args {
    context: Context;
  }
}
