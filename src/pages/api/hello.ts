// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@prisma/client";

type Data = {
  name: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const db = new prisma.PrismaClient();
  const player = await db.player.create({ data: { username: "Hugo!" } });
  console.log(player);
  res.status(200).json({ name: `John Doe` });
}
