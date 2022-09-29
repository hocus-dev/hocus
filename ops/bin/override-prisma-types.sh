#!/bin/bash

ORIGINAL_LINE="export type TransactionClient = Omit<PrismaClient, '\$connect' | '\$disconnect' | '\$on' | '\$transaction' | '\$use'>"
DESIRED_LINE="export interface TransactionClient extends Omit<PrismaClient, '\$connect' | '\$disconnect' | '\$on' | '\$transaction' | '\$use'> {}"

sed -i "s/$ORIGINAL_LINE/$DESIRED_LINE/g" node_modules/.prisma/client/index.d.ts
