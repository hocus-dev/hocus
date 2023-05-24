// must be the first import
import "./prisma-export-patch.server";

import fs from "fs/promises";

import { Prisma } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { Client as PgClient } from "pg";
import * as build from "prisma/build";
import { v4 as uuidv4 } from "uuid";

import { waitForPromises } from "~/utils.shared";

const DB_HOST = process.env.DB_HOST ?? "localhost";

const changeSequenceNumbers = async (db: Prisma.NonTransactionClient): Promise<void> => {
  const modelNames = Object.values(Prisma.ModelName).sort((a, b) => a.localeCompare(b));
  await waitForPromises(
    modelNames.map((name, idx) =>
      // When you pass model ids around, it's easy to accidentally pass an id representing one model
      // to a function that expects an id representing another model. By changing the sequence numbers
      // so that every model has its own range of ids, we can easily detect this kind of error
      // during testing.
      db.$executeRawUnsafe(`ALTER SEQUENCE "${name}_id_seq" RESTART WITH ${(idx + 1) * 1000000}`),
    ),
  );
};

export const provideDb = (
  testFn: (db: Prisma.NonTransactionClient) => Promise<void>,
): (() => Promise<void>) => {
  return async () => {
    const dbName = uuidv4();
    const dbUrl = `postgresql://postgres:pass@${DB_HOST}:5432/${dbName}`;
    const db = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });
    const schemaPath = `prisma/tmp-${dbName}.prisma`;
    const schemaContents = (await fs.readFile("prisma/schema.prisma", "utf-8")).replace(
      `env("PRISMA_DATABASE_URL")`,
      `"${dbUrl}"`,
    );
    await fs.writeFile(schemaPath, schemaContents);

    await build.ensureDatabaseExists("apply", true, schemaPath);
    const migrate = new build.Migrate(schemaPath);

    // eslint-disable-next-line no-console
    console.info = () => {};
    await migrate.applyMigrations();
    await fs.unlink(schemaPath);

    migrate.stop();

    await changeSequenceNumbers(db);

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
      host: DB_HOST,
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
