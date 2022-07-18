import { provideDb } from "@/test-utils";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.concurrent(
  "Hello world",
  provideDb(async (db) => {
    await db.player.create({ data: { username: "John Doe" } });
    expect(true).toBe(true);
  }),
);
test.concurrent(
  "Hello world 2",
  provideDb(async (db) => {
    await db.player.create({ data: { username: "John Doe" } });
    expect(true).toBe(true);
  }),
);
test.concurrent(
  "Hello world 3",
  provideDb(async (db) => {
    await db.player.create({ data: { username: "John Doe" } });
    expect(true).toBe(true);
  }),
);
test.concurrent(
  "Hello world 4",
  provideDb(async (db) => {
    await db.player.create({ data: { username: "John Doe" } });
    expect(true).toBe(true);
  }),
);
test.concurrent(
  "Hello world 5",
  provideDb(async (db) => {
    await db.player.create({ data: { username: "John Doe" } });
    throw new Error("wah!");
    expect(true).toBe(true);
  }),
);
