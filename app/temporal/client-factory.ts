import { Client, Connection } from "@temporalio/client";

import type { Config } from "~/config";
import { Token } from "~/token";

export const clientFactory = (
  config: Config,
): (<T>(fn: (client: Client) => Promise<T>) => Promise<T>) => {
  return async (fn) => {
    const { temporalServerUrl } = config.temporalConnection();
    const connection = await Connection.connect({ address: temporalServerUrl });
    try {
      const client = new Client({
        connection,
        dataConverter: {
          payloadConverterPath: require.resolve("~/temporal/data-converter"),
        },
      });
      return await fn(client);
    } finally {
      await connection.close();
      // Connection.close() does not clear the context storage, so we need to do it manually.
      // This is a bug in the temporal library. If not cleared manually, it causes a memory leak.
      // If connections are continuously created and closed, it eventually increases cpu usage to 100%.
      // This is because all AsyncLocalStorage instances are stored in a global object here:
      // https://github.com/nodejs/node/blob/9f3466bcb646dc2f568569813379be1252753a72/lib/async_hooks.js#L273
      // The AsyncLocalStorage instances are never removed from the global object, so it grows indefinitely.
      // Then, every time a promise is created, the global object is iterated over here:
      // https://github.com/nodejs/node/blob/6fd13beae07fdd8ba7e153c0b0ecc8b440407025/lib/async_hooks.js#L270
      // Once the global object grows large enough, creating a promise becomes a very expensive operation,
      // costing 10ms or more of CPU time. This is why CPU usage increases to 100%.
      connection.callContextStorage.disable();
    }
  };
};
clientFactory.inject = [Token.Config] as const;
