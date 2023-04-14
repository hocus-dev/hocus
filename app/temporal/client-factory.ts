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
    }
  };
};
clientFactory.inject = [Token.Config] as const;
