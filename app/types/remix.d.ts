// eslint-disable-next-line no-restricted-imports
import type { PrismaClient } from "@prisma/client";
import "@remix-run/node";
import type { DataFunctionArgs } from "@remix-run/node";
import type { Request, Response } from "express";

type Context = {
  db: PrismaClient;
  req: Request;
  res: Response;
};

declare module "@remix-run/node" {
  export interface LoaderArgs extends DataFunctionArgs {
    context: Context;
  }

  export interface ActionArgs extends DataFunctionArgs {
    context: Context;
  }
}
