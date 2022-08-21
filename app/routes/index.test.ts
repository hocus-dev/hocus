import { provideDb } from "~/test-utils/db";

test.concurrent(
  "index",
  provideDb(async (db) => {
    await db.player.create({ data: { username: "hugodutka" } });
    console.log(await db.player.findMany());
  }),
);
