/* eslint-disable camelcase */
import * as Sentry from "@sentry/node";
import { PostHog } from "posthog-node";
import { v4 as uuidv4 } from "uuid";

import type { Config } from "./config";
import { Token } from "./token";

export class TelemetryService {
  static inject = [Token.Config] as const;
  public readonly telemetryConfig: ReturnType<Config["telemetry"]>;
  public readonly deployId;
  #posthogClient: PostHog | null = null;
  #initialized: boolean = false;

  constructor(config: Config) {
    this.telemetryConfig = config.telemetry();
    if (this.telemetryConfig.deployId) {
      this.deployId = this.telemetryConfig.deployId;
    } else {
      // TODO: Share using the database/api
      this.deployId = uuidv4();
    }
  }

  async init(): Promise<void> {
    if (!this.telemetryConfig.disabled) {
      if (this.#initialized) return;
      this.#posthogClient = new PostHog(this.telemetryConfig.phogApiKey, {
        host: this.telemetryConfig.phogHost,
      });

      Sentry.init({
        dsn: this.telemetryConfig.sentryDSN,
        integrations: [
          {
            name: "hocus-sentry-posthog",
            setupOnce: (addGlobalEventProcessor: (callback: any) => void) => {
              addGlobalEventProcessor((event: any) => {
                if (event.level !== "error" && event.exception === void 0) return event;
                if (!event.tags) event.tags = {};
                const exceptions = event.exception?.values || [];
                event.tags["PostHog Person URL"] = "app.posthog.com/person/" + this.deployId;

                const data = {
                  // PostHog Exception Properties,
                  $exception_message: exceptions[0]?.value,
                  $exception_type: exceptions[0]?.type,
                  $exception_personURL: "app.posthog.com/person/" + this.deployId,
                  // Sentry Exception Properties
                  $sentry_event_id: event.event_id,
                  $sentry_exception: event.exception,
                  $sentry_exception_message: exceptions[0]?.value,
                  $sentry_exception_type: exceptions[0]?.type,
                  $sentry_tags: event.tags,
                  $sentry_url: `https://sentry.io/organizations/hocus/issues/?project=${this.telemetryConfig.sentryProjectId}&query=${event.event_id}`,
                };
                this.capture({ event: "$exception", properties: data });
                return event;
              });
            },
          },
        ],
      });

      this.#initialized = true;
    }
    return;
  }

  capture(msg: Omit<Parameters<PostHog["capture"]>[0], "distinctId">): void {
    if (this.#posthogClient) {
      this.#posthogClient.capture({ ...msg, distinctId: this.deployId });
    }
  }

  captureException(err: any): void {
    if (this.#posthogClient) {
      Sentry.captureException(err);
    }
  }

  async shutdown(): Promise<void> {
    if (!this.#initialized) return;
    if (this.#posthogClient) {
      await Sentry.close(4000);
      await this.#posthogClient.shutdownAsync();
    }
    this.#initialized = false;
    this.#posthogClient = null;
    return;
  }
}
