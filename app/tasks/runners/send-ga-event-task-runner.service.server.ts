import type { JobHelpers } from "graphile-worker";
import type { GoogleAnalyticsService } from "~/analytics/google-analytics.service.server";
import { AbstractTaskRunnerService } from "~/tasks/abstract-task-runner.service.server";
import { TaskId } from "~/tasks/schemas.server";
import type { TaskPayload } from "~/tasks/types.server";
import { Token } from "~/token";

const TASK_ID = TaskId.SendGAEvent;

export class SendGAEventTaskRunnerService extends AbstractTaskRunnerService<typeof TASK_ID> {
  static inject = [Token.GoogleAnalyticsService] as const;

  constructor(private readonly gaService: GoogleAnalyticsService) {
    super(TASK_ID);
  }

  protected async runValidated(payload: TaskPayload[typeof TASK_ID], _helpers: JobHelpers) {
    await this.gaService.sendEvent(payload);
  }
}
