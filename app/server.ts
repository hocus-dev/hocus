import express from "express";
import remix from "@remix-run/express";
// eslint-disable-next-line no-restricted-imports
import { PrismaClient } from "@prisma/client";

const app = express();

app.all("*", (req, res, next) => {
  return remix.createRequestHandler({
    build: require("./build"),
    getLoadContext() {
      return { db: new PrismaClient() };
    },
  })(req, res, next);
});
