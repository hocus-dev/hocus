// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@prisma/client";
import z from "zod";
import { limitMethod } from "./utils";

const BodySchema = z.object({
  playerId: z.string().regex(/^\d+$/).transform(BigInt),
  roomName: z.string().min(1),
});

type Data = {
  roomId: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  limitMethod(req, res, "POST");

  const body = BodySchema.parse(req.body);
  const db = new prisma.PrismaClient();
  const player = await db.player.findUniqueOrThrow({ where: { id: body.playerId } });
  const room = await db.room.create({ data: { playerId: player.id, name: body.roomName } });
  res.status(200).json({ roomId: room.id.toString() });
}
