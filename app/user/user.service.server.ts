import type { User, Prisma } from "@prisma/client";
import { GAEventName } from "~/analytics/event.server";
import { TaskId } from "~/tasks/schemas.server";
import type { TaskService } from "~/tasks/task.service.server";
import { Token } from "~/token";

export class UserService {
  static inject = [Token.TaskService] as const;

  constructor(private readonly taskService: TaskService) {}

  async getOrCreateUser(
    db: Prisma.NonTransactionClient,
    externalId: string,
    registrationMethod: string,
  ): Promise<User> {
    const user = await db.user.findUnique({ where: { externalId } });
    if (user != null) {
      return user;
    }

    return await db.$transaction(async (tdb) => {
      const user = await tdb.user.create({ data: { externalId } });
      await this.taskService.scheduleTask(tdb, {
        taskId: TaskId.SendGAEvent,
        payload: {
          userId: user.gaUserId,
          name: GAEventName.SignUp,
          params: { method: registrationMethod },
        },
      });
      return user;
    });
  }
}
