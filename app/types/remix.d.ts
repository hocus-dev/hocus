// eslint-disable-next-line no-restricted-imports
import type { PrismaClient } from "@prisma/client";
import "@remix-run/node";
import type { DataFunctionArgs } from "@remix-run/node";
import type { Request } from "express";

declare module "@remix-run/node" {
  export interface LoaderArgs extends DataFunctionArgs {
    context: { db: PrismaClient; req: Request };
  }

  export interface ActionArgs extends DataFunctionArgs {
    context: { db: PrismaClient; req: Request };
  }
}
