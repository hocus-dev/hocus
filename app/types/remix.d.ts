// eslint-disable-next-line no-restricted-imports
import type { PrismaClient } from "@prisma/client";
import "@remix-run/node";
import type { DataFunctionArgs } from "@remix-run/node";
import type { User } from "@supabase/gotrue-js";
import type { Request, Response } from "express";
import type { AppInjector } from "~/services/app-injector";

type Context = {
  db: PrismaClient;
  app: AppInjector;
  req: Request;
  res: Response;
  user: User | null;
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
