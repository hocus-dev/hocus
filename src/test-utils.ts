import prisma from "@prisma/client";
import * as build from "prisma/build";
import { v4 as uuidv4 } from "uuid";
import "process";
import { Client as PgClient } from "pg";

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
    process.env.DATABASE_URL = dbUrl;
    const schemaPath = "prisma/schema.prisma";
    await build.ensureDatabaseExists("apply", true, schemaPath);
    const migrate = new build.Migrate(schemaPath);
    const tmp = console.info;
    console.info = () => {};
    await migrate.applyMigrations();
    console.info = tmp;
    migrate.stop();
    await testFn(db);
    await db.$disconnect();

    const pgClient = new PgClient({
      user: "postgres",
      password: "pass",
      host: "localhost",
      port: 5432,
    });
    const query = `DROP DATABASE "${dbName}" WITH (FORCE);`;
    await pgClient.connect();
    await pgClient.query(query);
    await pgClient.end();
  };
};
