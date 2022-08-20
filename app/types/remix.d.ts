import type { PrismaClient } from "@prisma/client";
import "@remix-run/node";
import type { DataFunctionArgs } from "@remix-run/node";

declare module "@remix-run/node" {
  export interface LoaderArgs extends DataFunctionArgs {
    context: { db: PrismaClient };
  }

  export interface ActionArgs extends DataFunctionArgs {
    context: { db: PrismaClient };
  }
}
