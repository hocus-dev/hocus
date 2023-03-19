import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";

export class UserService {
  static inject = [] as const;

  async getOrCreateUser(
    db: Prisma.NonTransactionClient,
    externalId: string,
    _loginMethod: string,
  ): Promise<User> {
    let user = await db.user.findUnique({ where: { externalId } });
    if (user != null) {
      return user;
    }

    return await db.$transaction(async (tdb) => {
      await tdb.$executeRawUnsafe(
        `LOCK TABLE "${Prisma.ModelName.User}" IN SHARE UPDATE EXCLUSIVE MODE`,
      );
      user = await db.user.findUnique({ where: { externalId } });
      if (user != null) {
        return user;
      }

      user = await tdb.user.create({ data: { externalId } });
      return user;
    });
  }
}
