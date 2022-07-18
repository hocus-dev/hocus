import type { NextApiRequest, NextApiResponse } from "next";

export const limitMethod = (
  req: NextApiRequest,
  res: NextApiResponse,
  httpMethod: "POST" | "GET",
): void => {
  if (req.method !== httpMethod) {
    res.status(405).send({ message: `Only ${httpMethod} requests allowed` });
    res.end();
    throw new Error("wrong method!");
  }
};
