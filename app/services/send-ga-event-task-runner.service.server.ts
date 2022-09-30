import type { JobHelpers } from "graphile-worker";
import { TaskId } from "~/tasks/schemas.server";
import type { TaskPayload } from "~/tasks/types.server";

import { AbstractTaskRunnerService } from "./abstract-task-runner.service.server";

const TASK_ID = TaskId.SendGAEvent;

export class SendGAEventTaskRunnerService extends AbstractTaskRunnerService<typeof TASK_ID> {
  constructor() {
    super(TASK_ID);
  }

  protected async runValidated(payload: TaskPayload[typeof TASK_ID], helpers: JobHelpers) {
    helpers.logger.info(payload.category);
  }
}
