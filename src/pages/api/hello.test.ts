import { provideDb } from "@/test-utils";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test(
  "Hello world",
  provideDb(async (db) => {
    await db.player.create({ data: { username: "John Doe" } });
    expect(true).toBe(true);
  }),
);
