/* eslint-disable no-console */
// must be the first import
import "~/test-utils/prisma-export-patch.server";

import fs from "fs/promises";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Prisma, PrismaClient } from "@prisma/client";
import { EJSON } from "bson";
import { Client as PgClient } from "pg";
import * as build from "prisma/build";
import { v4 as uuidv4 } from "uuid";

import { execCmd } from "~/agent/utils";
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

let adminDbConnection: Promise<PgClient> | null = null;
const templateDbNames = new Map<string, Promise<string>>();

async function connectAsAdmin(): Promise<PgClient> {
  console.log("Connecting as admin to database");
  const pgClient = new PgClient({
    user: "postgres",
    password: "pass",
    host: DB_HOST,
    port: 5432,
  });
  await pgClient.connect();
  console.log("Connected to database as admin");
  return pgClient;
}

async function getAdminConnection(): Promise<PgClient> {
  if (adminDbConnection !== null) return adminDbConnection;
  adminDbConnection = connectAsAdmin();
  return await adminDbConnection;
}

async function setupTemplateDb(prismaSchemaPath: string, schemaHash: string): Promise<string> {
  const dbName = `template-${schemaHash}`;
  console.log(`Preparing template database ${dbName} from ${prismaSchemaPath}`);
  const dbUrl = `postgresql://postgres:pass@${DB_HOST}:5432/${dbName}`;

  // Warning: Prisma assumes that the schema is in a directory with migrations ;)
  // Don't move this to /tmp
  const schemaPath = `prisma/tmp-${uuidv4()}.prisma`;
  try {
    const schemaContents = (await fs.readFile(prismaSchemaPath, "utf-8")).replace(
      `env("PRISMA_DATABASE_URL")`,
      `"${dbUrl}"`,
    );
    await fs.writeFile(schemaPath, schemaContents);

    await build.ensureDatabaseExists("apply", true, schemaPath);
    const migrate = new build.Migrate(schemaPath);
    await migrate.applyMigrations();
    migrate.stop();
  } finally {
    await fs.unlink(schemaPath);
  }

  const db = new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
  });
  await changeSequenceNumbers(db);
  await db.$disconnect();

  return dbName;
}

export async function setupTestDatabase(
  prismaSchemaPath: string,
  cleanupClosures: ((debugDumpDir: string | null) => Promise<void>)[],
): Promise<string> {
  const migrationsDir = path.join(path.dirname(prismaSchemaPath), "migrations");
  // Hash together the schema contents and the access times of migration files ;)
  const hashExec = await execCmd(
    "bash",
    "-c",
    `ls -lAgGR --block-size=1 --time-style=+%s "${migrationsDir}" | sha256sum - "${prismaSchemaPath}" | sha256sum`,
  );
  const schemaHash = hashExec.stdout.split(" ")[0];
  let templateDbNamePromise = templateDbNames.get(schemaHash);
  if (templateDbNamePromise === void 0) {
    templateDbNamePromise = setupTemplateDb(prismaSchemaPath, schemaHash);
    templateDbNames.set(schemaHash, templateDbNamePromise);
  }
  const templateDbName = await templateDbNamePromise;
  const testDbName = `test-${uuidv4()}`;
  const adminConn = await getAdminConnection();
  console.log(`Creating ${testDbName} from template ${templateDbName}`);
  await adminConn.query(`CREATE DATABASE "${testDbName}" TEMPLATE "${templateDbName}";`);
  const testDbUrl = `postgresql://postgres:pass@${DB_HOST}:5432/${testDbName}`;

  cleanupClosures.push(async (debugDumpDir) => {
    if (debugDumpDir !== null) {
      console.log(`Dumping ${testDbName} for debugging`);
      // PG dump would be better here but pg_dump is hardcoded to a specific version of postgres...
      // I'm not using pg_dump cause it causes dependency hell
      const db = new PrismaClient({
        datasources: {
          db: { url: testDbUrl },
        },
      });
      try {
        const modelNames = Object.values(Prisma.ModelName).sort((a, b) => a.localeCompare(b));
        const dbDump = EJSON.stringify(
          Object.fromEntries(
            (
              await waitForPromises(
                modelNames.map(async (name) => [name, await ((db as any)[name] as any).findMany()]),
              )
            ).filter(([_, e]) => e.length > 0),
          ),
          void 0,
          2,
        );
        await fs.writeFile(path.join(debugDumpDir, `db-${testDbName}.json`), dbDump);
      } catch (err) {
        console.error("Ignoring error ", err);
      } finally {
        await db.$disconnect();
      }
    }
    await adminConn.query(`DROP DATABASE "${testDbName}" WITH (FORCE);`);
  });

  return testDbUrl;
}

export async function onServerExit(): Promise<void> {
  if (adminDbConnection !== null) {
    console.log("Terminating admin database connection");
    await (await adminDbConnection).end();
  }
}
