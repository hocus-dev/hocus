import type { Prisma } from "@prisma/client";
import type { Any } from "ts-toolbelt";

const _nonTxClientAssignableToClient: Any.Extends<Prisma.NonTransactionClient, Prisma.Client> = 1;
const _txClientAssignableToClient: Any.Extends<Prisma.TransactionClient, Prisma.Client> = 1;
const _clientNotAssignableToTxClient: Any.Extends<Prisma.Client, Prisma.TransactionClient> = 0;
const _clientNotAssignableToNonTxClient: Any.Extends<
  Prisma.Client,
  Prisma.NonTransactionClient
> = 0;
