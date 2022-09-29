import _ from "@prisma/client";

declare module "@prisma/client" {
  export namespace Prisma {
    export interface TransactionClient {
      /**
       * this is a hack to make the typescript compiler not allow assigning
       * a PrismaClient to a Prisma.TransactionClient
       * */
      "dont-assign-a-regular-PrismaClient-to-a-Prisma.TransactionClient": null;
    }
  }
}
