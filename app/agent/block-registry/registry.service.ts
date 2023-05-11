import { DefaultLogger } from "@temporalio/worker";

import { Config } from "~/config";
import { Token } from "~/token";

export interface Image {
  id: string;
}

export interface Container {
  id: string;
}

export class BlockRegistryService {
  static inject = [Token.Logger, Token.Config] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;

  constructor(private readonly logger: DefaultLogger, config: Config) {
    this.agentConfig = config.agent();
  }
}
