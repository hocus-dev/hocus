import { parseRemixData, provideLoaderArgs } from "~/test-utils/remix.server";

import { loader } from "../routes/index";

test.concurrent(
  "index loader",
  provideLoaderArgs(async (args) => {
    const db = args.context.db;
    args.context.req.csrfToken = () => "token";

    const result = await parseRemixData(loader(args));
    expect(result.players).toHaveLength(0);
    await db.player.create({ data: { username: "hugodutka" } });
    const result2 = await parseRemixData(loader(args));
    expect(result2.players).toHaveLength(1);
  }),
);
