import { Axios } from "axios";
import type { Any } from "ts-toolbelt";
import type { Logger } from "winston";
import type { Config } from "~/config";
import { Env } from "~/config/utils.server";
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
  private readonly env: ReturnType<Config["env"]>;

  constructor(private readonly logger: Logger, config: Config) {
    this.config = config.googleAnalytics();
    this.env = config.env();
    this.httpClient = new Axios({ baseURL: removeTrailingSlash(this.config.url) });
  }

  async sendEvent(args: SendEventArgs): Promise<void> {
    /* eslint-disable camelcase */
    const response = await this.httpClient.post(
      "/mp/collect",
      JSON.stringify({
        client_id: this.config.clientId,
        user_id: args.userId,
        events: [{ name: args.name, params: args.params }],
      }),
      { params: { measurement_id: this.config.measurementId, api_secret: this.config.apiSecret } },
    );

    if (this.env === Env.Test) {
      this.logger.debug(response.data);
      const validationMessages = JSON.parse(response.data).validationMessages;
      if (validationMessages.length !== 0) {
        throw new Error(`Invalid GA event: ${response.data}`);
      }
    }
    /* eslint-enable camelcase */
    this.logger.debug(
      `Google Analytics Response: ${response.status}, ${response.statusText}, ${JSON.stringify(
        response.data,
      )}`,
    );
  }
}
