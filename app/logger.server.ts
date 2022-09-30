import winston from "winston";

import type { Config } from "./config";
import { Token } from "./token";

export const newLogger = (config: Config): winston.Logger => {
  return winston.createLogger({
    level: config.logLevel(),
    defaultMeta: {},
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
  });
};
newLogger.inject = [Token.Config] as const;
