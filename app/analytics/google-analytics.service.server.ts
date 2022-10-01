import { Axios } from "axios";
import type { Any } from "ts-toolbelt";
import type { Config } from "~/config";
import { removeTrailingSlash } from "~/utils.shared";

import type { GAEventName, GAEventPayload, GAEventUserIdRequired } from "./event.server";

import type { valueof } from "~/types/utils";

type SendEventParams = valueof<{
  [Name in GAEventName]: Any.Compute<
    {
      name: Name;
      payload: GAEventPayload[Name];
    } & (typeof GAEventUserIdRequired[Name] extends true ? { userId: string } : {})
  >;
}>;

/**
 * https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export class GoogleAnalyticsService {
  private readonly httpClient: Axios;
  private readonly config: ReturnType<Config["googleAnalytics"]>;

  constructor(config: Config) {
    this.config = config.googleAnalytics();
    this.httpClient = new Axios({ baseURL: removeTrailingSlash(this.config.url) });
  }

  async sendEvent(params: SendEventParams): Promise<void> {
    await this.httpClient.post("/mp/collect", {
      /* eslint-disable camelcase */
      client_id: this.config.clientId,
      user_id: params.userId,
      events: [params.payload],
      /* eslint-enable camelcase */
    });
  }
}
