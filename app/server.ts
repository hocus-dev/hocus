// eslint-disable-next-line no-restricted-imports
import { PrismaClient } from "@prisma/client";
import remix from "@remix-run/express";
import express from "express";

const app = express();

app.all("*", (req, res, next) => {
  return remix.createRequestHandler({
    build: require("./build"),
    getLoadContext() {
      return { db: new PrismaClient() };
    },
  })(req, res, next);
});
