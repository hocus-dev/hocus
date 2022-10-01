import { Axios } from "axios";
import type { Any } from "ts-toolbelt";
import type { Logger } from "winston";
import type { Config } from "~/config";
import { Token } from "~/token";
import { removeTrailingSlash } from "~/utils.shared";

import type { GAEventName, GAEventPayload, GAEventUserIdRequired } from "./event.server";

import type { valueof } from "~/types/utils";

type SendEventArgs = valueof<{
  [Name in GAEventName]: Any.Compute<
    {
      name: Name;
      params: GAEventPayload[Name];
    } & (typeof GAEventUserIdRequired[Name] extends true ? { userId: string } : {})
  >;
}>;

/**
 * https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export class GoogleAnalyticsService {
  static inject = [Token.Logger, Token.Config] as const;
  private readonly httpClient: Axios;
  private readonly config: ReturnType<Config["googleAnalytics"]>;

  constructor(private readonly logger: Logger, config: Config) {
    this.config = config.googleAnalytics();
    this.httpClient = new Axios({ baseURL: removeTrailingSlash(this.config.url) });
  }

  async sendEvent(args: SendEventArgs): Promise<void> {
    /* eslint-disable camelcase */
    const response = await this.httpClient.post(
      "/mp/collect",
      JSON.stringify({
        client_id: this.config.clientId,
        user_id: args.userId,
        events: [{ name: args.name, args: args.params }],
      }),
      { params: { measurement_id: this.config.measurementId, api_secret: this.config.apiSecret } },
    );
    /* eslint-enable camelcase */
    this.logger.debug(
      `Google Analytics Response: ${response.status}, ${response.statusText}, ${JSON.stringify(
        response.data,
      )}`,
    );
  }
}
