import type { Prisma, User } from "@prisma/client";
import "@remix-run/node";
import type { DataFunctionArgs } from "@remix-run/node";
import type { Request, Response } from "express";

import type { AppInjector } from "~/app-injector.server";
import type { HttpError } from "~/http-error.server";
import type { OidcUser } from "~/schema/oidc-user.validator.server";

type Context = {
  db: Prisma.NonTransactionClient;
  app: AppInjector;
  req: Request;
  res: Response;
  user?: User;
  oidcUser?: OidcUser;
  /** Used by root.tsx to handle errors thrown outside of Remix */
  expressError?: HttpError;
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
