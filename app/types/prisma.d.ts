import type prisma from "@prisma/client";

declare const msg = "Don't assign a regular PrismaClient to a Prisma.TransactionClient!";

declare module "@prisma/client" {
  export namespace Prisma {
    export interface TransactionClient {
      /**
       * this is a hack to make the typescript compiler not allow assigning
       * a PrismaClient to a Prisma.TransactionClient
       * */
      [msg]: null;
    }

    export interface NonTransactionClient extends prisma.PrismaClient {}

    export interface Client extends Omit<TransactionClient, typeof msg> {}
  }
}
