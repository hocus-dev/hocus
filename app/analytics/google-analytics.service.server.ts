import { Axios } from "axios";
import type { Config } from "~/config";

/**
 * https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export class GoogleAnalyticsService {
  private readonly httpClient: Axios;
  private readonly config: ReturnType<Config["googleAnalytics"]>;

  constructor(config: Config) {
    this.config = config.googleAnalytics();
    this.httpClient = new Axios({ baseURL: this.config.url });
  }

  async sendEvent(userId: string | null) {}
}
