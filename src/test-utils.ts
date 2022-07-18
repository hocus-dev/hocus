// must be the first import
import "./test-utils-prisma";

import prisma from "@prisma/client";
import * as build from "prisma/build";
import { v4 as uuidv4 } from "uuid";
import "process";
import { Client as PgClient } from "pg";
import fs from "fs";

export const provideDb = (
  testFn: (db: prisma.PrismaClient) => Promise<void>,
): (() => Promise<void>) => {
  return async () => {
    const dbName = uuidv4();
    const dbUrl = `postgresql://postgres:pass@localhost:5432/${dbName}?schema=public`;
    const db = new prisma.PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });
    const schemaPath = `prisma/tmp-${dbName}.prisma`;
    const schemaContents = fs
      .readFileSync("prisma/schema.prisma")
      .toString()
      .replace(`env("DATABASE_URL")`, `"${dbUrl}"`);
    fs.writeFileSync(schemaPath, schemaContents);

    await build.ensureDatabaseExists("apply", true, schemaPath);
    const migrate = new build.Migrate(schemaPath);

    console.info = () => {};
    await migrate.applyMigrations();
    fs.unlinkSync(schemaPath);

    migrate.stop();
    let error = null;
    try {
      await testFn(db);
    } catch (err) {
      error = err;
    }
    await db.$disconnect();

    const pgClient = new PgClient({
      user: "postgres",
      password: "pass",
      host: "localhost",
      port: 5432,
    });
    const query = `DROP DATABASE "${dbName}";`;
    await pgClient.connect();
    await pgClient.query(query);
    await pgClient.end();

    if (error != null) {
      throw error;
    }
  };
};
