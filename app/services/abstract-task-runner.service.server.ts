import type { JobHelpers } from "graphile-worker";
import type { TaskId } from "~/tasks/schemas.server";
import type { TaskPayload } from "~/tasks/types.server";
import { TaskValidators } from "~/tasks/validators.server";

export abstract class AbstractTaskRunnerService<Id extends TaskId> {
  protected readonly payloadValidator: typeof TaskValidators[Id];

  constructor(public readonly taskId: Id) {
    this.payloadValidator = TaskValidators[taskId];
  }

  public async run(payload: unknown, helpers: JobHelpers): Promise<void> {
    const result = this.payloadValidator.SafeParse(payload);
    if (!result.success) {
      helpers.logger.error(`Failed to parse payload: ${result.error.message}`);
      throw result.error;
    }
    await this.runValidated(result.value, helpers);
  }

  protected abstract runValidated(payload: TaskPayload[Id], helpers: JobHelpers): Promise<void>;
}
