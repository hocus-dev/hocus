import type { Logger } from "@temporalio/worker";

import type { Config } from "./config";
import { Token } from "./token";

export class PerfService {
  static inject = [Token.Config, Token.Logger] as const;
  private readonly enabled: boolean;

  constructor(config: Config, private readonly logger: { info: Logger["info"] }) {
    this.enabled = config.perfMonitoring().enabled;
  }

  log(...args: unknown[]): void {
    if (!this.enabled) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log(new Date(), args);
  }
}
